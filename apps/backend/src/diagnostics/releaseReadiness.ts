import { ReleaseEvidenceRecord, ReplayMonitorSnapshot } from '../types';
import { createDegradedReplayExport, DegradedReplayExportBundle } from './continuityExport';
import { DEFAULT_REPLAY_STREAM, getReplayMonitorHistory, monitorReplayHistory, stableStringify } from './replayHistory';
import { RuntimeValidationReport, validateRuntimeEnvironment } from './runtimeValidation';
import { getStorageRepository } from '../storage/repository';
import { hashString } from '../utils/prng';

export type ReleaseGateStatus = 'ready' | 'degraded' | 'blocked';
export type ReleaseProvider = 'local-docker' | 'railway' | 'render' | 'custom';

export interface ReleaseGateReport {
  name: string;
  status: ReleaseGateStatus;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface ReleaseRollbackPreflightReport {
  status: ReleaseGateStatus;
  detail: string;
  degradedExportChecksum?: string;
  monitorSnapshotId?: string;
  recommendations: string[];
}

export interface ReleaseReadinessReport {
  status: ReleaseGateStatus;
  checkedAt: number;
  stream: string;
  provider: ReleaseProvider;
  runtime: RuntimeValidationReport;
  replayMonitor: Awaited<ReturnType<typeof monitorReplayHistory>>;
  latestMonitorSnapshot?: ReplayMonitorSnapshot;
  latestAlertSnapshot?: ReplayMonitorSnapshot;
  latestAcknowledgedAlertSnapshot?: ReplayMonitorSnapshot;
  gates: ReleaseGateReport[];
  rollbackPreflight: ReleaseRollbackPreflightReport;
  recommendations: string[];
}

export interface ReleaseReadinessOptions {
  stream?: string;
  provider?: string;
  persistMonitor?: boolean;
  persistEvidence?: boolean;
  includeRollbackPreflight?: boolean;
}

export interface ReleaseEvidenceExportOptions extends ReleaseReadinessOptions {
  limit?: number;
}

export interface ReleaseEvidenceExportBundle {
  version: 'agros-release-evidence-v1';
  id: string;
  exportedAt: number;
  stream: string;
  provider: ReleaseProvider;
  release: ReleaseReadinessReport;
  evidenceRecord: ReleaseEvidenceRecord;
  history: ReleaseEvidenceRecord[];
  degradedReplayExport: DegradedReplayExportBundle | null;
  exportChecksum: string;
}

const PROVIDERS = new Set(['local-docker', 'railway', 'render', 'custom']);

function normalizeProvider(provider?: string): ReleaseProvider {
  const candidate = (provider || 'local-docker').trim().toLowerCase();
  return PROVIDERS.has(candidate) ? candidate as ReleaseProvider : 'custom';
}

function summarizeRuntimeGate(runtime: RuntimeValidationReport): ReleaseGateReport {
  return {
    name: 'runtime',
    status: runtime.status === 'ready' ? 'ready' : 'degraded',
    detail: runtime.warnings.length ? runtime.warnings.join('; ') : 'runtime environment is ready',
    evidence: {
      databaseProvider: runtime.config.databaseProvider,
      workersEnabled: runtime.config.workersEnabled,
      queueMode: runtime.config.queueMode,
    },
  };
}

function summarizeReplayGate(
  replayMonitor: Awaited<ReturnType<typeof monitorReplayHistory>>,
): ReleaseGateReport {
  return {
    name: 'replay_monitor',
    status: replayMonitor.status === 'ready' ? 'ready' : 'degraded',
    detail: replayMonitor.alerts.length ? replayMonitor.alerts.join('; ') : 'replay monitor is ready',
    evidence: {
      eventCount: replayMonitor.verification.eventCount,
      checkpointCount: replayMonitor.verification.checkpointCount,
      latestCheckpointId: replayMonitor.verification.latestCheckpointId,
      snapshotId: replayMonitor.snapshotId,
    },
  };
}

function summarizeAcknowledgementGate(
  latestAlertSnapshot?: ReplayMonitorSnapshot,
  latestAcknowledgedAlertSnapshot?: ReplayMonitorSnapshot,
): ReleaseGateReport {
  if (!latestAlertSnapshot) {
    return {
      name: 'alert_acknowledgement',
      status: 'ready',
      detail: 'no replay monitor alerts require acknowledgement',
    };
  }

  if (!latestAlertSnapshot.acknowledgedAt) {
    return {
      name: 'alert_acknowledgement',
      status: 'blocked',
      detail: `latest replay alert snapshot ${latestAlertSnapshot.id} is not acknowledged`,
      evidence: {
        alertCount: latestAlertSnapshot.alertCount,
        alerts: latestAlertSnapshot.alerts,
        snapshotId: latestAlertSnapshot.id,
      },
    };
  }

  return {
    name: 'alert_acknowledgement',
    status: 'ready',
    detail: `latest replay alert acknowledged by ${latestAlertSnapshot.acknowledgedBy ?? 'operator'}`,
    evidence: {
      acknowledgedAt: latestAlertSnapshot.acknowledgedAt,
      acknowledgedBy: latestAlertSnapshot.acknowledgedBy,
      latestAcknowledgedSnapshotId: latestAcknowledgedAlertSnapshot?.id,
      snapshotId: latestAlertSnapshot.id,
    },
  };
}

function releaseStatus(gates: ReleaseGateReport[]): ReleaseGateStatus {
  if (gates.some(gate => gate.status === 'blocked')) return 'blocked';
  if (gates.some(gate => gate.status === 'degraded')) return 'degraded';
  return 'ready';
}

function releaseRecommendations(
  status: ReleaseGateStatus,
  gates: ReleaseGateReport[],
  rollbackPreflight: ReleaseRollbackPreflightReport,
): string[] {
  const recommendations = new Set<string>();

  if (status === 'ready') {
    recommendations.add('Proceed with release after recording this readiness report.');
  }

  for (const gate of gates) {
    if (gate.name === 'runtime' && gate.status !== 'ready') {
      recommendations.add('Resolve runtime warnings before release or record an explicit operator exception.');
    }
    if (gate.name === 'replay_monitor' && gate.status !== 'ready') {
      recommendations.add('Run recovery verification and checkpoint diff before release.');
    }
    if (gate.name === 'alert_acknowledgement' && gate.status === 'blocked') {
      recommendations.add('Acknowledge or resolve the latest replay alert snapshot before release.');
    }
  }
  if (rollbackPreflight.status === 'blocked') {
    recommendations.add('Create a degraded replay export before rollback or release exception handling.');
  }

  if (status !== 'ready') {
    recommendations.add('Block automated release promotion until every gate is ready or explicitly accepted.');
  }

  return Array.from(recommendations);
}

async function collectRollbackPreflight(
  status: ReleaseGateStatus,
  stream: string,
  latestMonitorSnapshot?: ReplayMonitorSnapshot,
  latestAlertSnapshot?: ReplayMonitorSnapshot,
  includeRollbackPreflight = false,
): Promise<ReleaseRollbackPreflightReport> {
  if (!includeRollbackPreflight && status === 'ready') {
    return {
      status: 'ready',
      detail: 'release is ready; rollback evidence bundle is not required',
      recommendations: [],
    };
  }

  try {
    const snapshotId = latestAlertSnapshot?.id ?? latestMonitorSnapshot?.id;
    const degradedExport = await createDegradedReplayExport({ stream, snapshotId, limit: 20 });
    return {
      status: 'ready',
      detail: 'latest degraded replay bundle is available for rollback preflight',
      degradedExportChecksum: degradedExport.exportChecksum,
      monitorSnapshotId: degradedExport.monitorSnapshot?.id,
      recommendations: degradedExport.recommendations,
    };
  } catch (error) {
    return {
      status: 'blocked',
      detail: error instanceof Error ? error.message : String(error),
      recommendations: ['Generate a degraded replay export before release exception handling.'],
    };
  }
}

function releaseEvidenceId(report: ReleaseReadinessReport): string {
  return `release_${hashString(stableStringify({
    checkedAt: report.checkedAt,
    provider: report.provider,
    status: report.status,
    stream: report.stream,
    monitorSnapshotId: report.latestMonitorSnapshot?.id ?? null,
    alertSnapshotId: report.latestAlertSnapshot?.id ?? null,
  }))}`;
}

export async function persistReleaseEvidence(
  report: ReleaseReadinessReport,
): Promise<ReleaseEvidenceRecord> {
  const gates = report.gates;
  return getStorageRepository().releaseEvidence.save({
    id: releaseEvidenceId(report),
    stream: report.stream,
    provider: report.provider,
    status: report.status,
    checkedAt: report.checkedAt,
    gateCount: gates.length,
    blockedGateCount: gates.filter(gate => gate.status === 'blocked').length,
    degradedGateCount: gates.filter(gate => gate.status === 'degraded').length,
    latestMonitorSnapshotId: report.latestMonitorSnapshot?.id,
    latestAlertSnapshotId: report.latestAlertSnapshot?.id,
    rollbackStatus: report.rollbackPreflight.status,
    latestDegradedExportChecksum: report.rollbackPreflight.degradedExportChecksum,
    report: report as unknown as Record<string, unknown>,
  });
}

export async function collectReleaseReadiness(
  options: ReleaseReadinessOptions = {},
): Promise<ReleaseReadinessReport> {
  const stream = options.stream ?? DEFAULT_REPLAY_STREAM;
  const provider = normalizeProvider(options.provider);
  const runtime = validateRuntimeEnvironment();
  const replayMonitor = await monitorReplayHistory(stream, { persist: options.persistMonitor });
  const snapshots = await getReplayMonitorHistory(stream, 20);
  const latestMonitorSnapshot = replayMonitor.snapshotId
    ? snapshots.find(snapshot => snapshot.id === replayMonitor.snapshotId) ?? snapshots[0]
    : snapshots[0];
  const latestAlertSnapshot = snapshots.find(snapshot => snapshot.alertCount > 0);
  const latestAcknowledgedAlertSnapshot = snapshots.find(snapshot => (
    snapshot.alertCount > 0 && Boolean(snapshot.acknowledgedAt)
  ));
  const gates = [
    summarizeRuntimeGate(runtime),
    summarizeReplayGate(replayMonitor),
    summarizeAcknowledgementGate(latestAlertSnapshot, latestAcknowledgedAlertSnapshot),
  ];
  const status = releaseStatus(gates);
  const rollbackPreflight = await collectRollbackPreflight(
    status,
    stream,
    latestMonitorSnapshot,
    latestAlertSnapshot,
    options.includeRollbackPreflight,
  );

  const report: ReleaseReadinessReport = {
    status,
    checkedAt: Date.now(),
    stream,
    provider,
    runtime,
    replayMonitor,
    latestMonitorSnapshot,
    latestAlertSnapshot,
    latestAcknowledgedAlertSnapshot,
    gates,
    rollbackPreflight,
    recommendations: releaseRecommendations(status, gates, rollbackPreflight),
  };

  if (options.persistEvidence !== false) {
    await persistReleaseEvidence(report);
  }

  return report;
}

export async function getReleaseEvidenceHistory(
  stream?: string,
  limit = 20,
): Promise<ReleaseEvidenceRecord[]> {
  return getStorageRepository().releaseEvidence.getLatest(stream, limit);
}

export async function createReleaseEvidenceExport(
  options: ReleaseEvidenceExportOptions = {},
): Promise<ReleaseEvidenceExportBundle> {
  const release = await collectReleaseReadiness({
    ...options,
    persistEvidence: false,
    includeRollbackPreflight: true,
  });
  const evidenceRecord = await persistReleaseEvidence(release);
  const history = await getReleaseEvidenceHistory(release.stream, options.limit ?? 20);
  const snapshotId = release.latestAlertSnapshot?.id ?? release.latestMonitorSnapshot?.id;
  const degradedReplayExport = release.rollbackPreflight.degradedExportChecksum
    ? await createDegradedReplayExport({ stream: release.stream, snapshotId, limit: 20 })
    : null;
  const exportedAt = Date.now();
  const id = `release_export_${hashString(stableStringify({
    evidenceId: evidenceRecord.id,
    exportedAt,
    provider: release.provider,
    stream: release.stream,
  }))}`;

  return {
    version: 'agros-release-evidence-v1',
    id,
    exportedAt,
    stream: release.stream,
    provider: release.provider,
    release,
    evidenceRecord,
    history,
    degradedReplayExport,
    exportChecksum: hashString(stableStringify({
      degradedReplayChecksum: degradedReplayExport?.exportChecksum ?? null,
      evidenceId: evidenceRecord.id,
      historyCount: history.length,
      releaseStatus: release.status,
      rollbackStatus: release.rollbackPreflight.status,
      stream: release.stream,
    })),
  };
}
