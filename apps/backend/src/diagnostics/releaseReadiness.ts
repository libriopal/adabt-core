import {
  ReleaseDecisionRecord,
  ReleaseEvidenceRecord,
  ReleaseReconciliationRecord,
  ReplayMonitorSnapshot,
} from '../types';
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

export interface ReleaseEvidenceHistoryFilters {
  provider?: string;
  status?: ReleaseGateStatus;
  rollbackStatus?: ReleaseGateStatus;
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

export type ReleaseDecisionOutcome = 'go' | 'no-go' | 'exception';

export interface ReleaseDecisionInput {
  evidenceId: string;
  decision: ReleaseDecisionOutcome;
  reason: string;
  decidedBy?: string;
}

export interface ReleaseReconciliationInput {
  decisionId: string;
  commitSha: string;
  branch: string;
  pullRequestUrl?: string;
  sourceThread?: string;
  initiatedBy?: string;
}

export interface ReleaseEvidenceComparison {
  stream: string;
  providers: string[];
  comparedAt: number;
  allMatched: boolean;
  baselineChecksum?: string;
  records: Array<{
    provider: string;
    evidenceId?: string;
    status?: ReleaseGateStatus;
    rollbackStatus?: ReleaseGateStatus;
    checkedAt?: number;
    evidenceChecksum?: string;
    providerSignature?: string;
    missing: boolean;
  }>;
}

export interface ReleaseRetentionInput {
  stream?: string;
  provider?: string;
  retainLatest?: number;
  dryRun?: boolean;
}

export interface ReleaseRetentionReport {
  version: 'agros-release-retention-v1';
  stream: string;
  provider?: string;
  retainLatest: number;
  dryRun: boolean;
  evaluatedCount: number;
  candidateCount: number;
  deletedCount: number;
  candidates: Array<{
    evidenceId: string;
    provider: string;
    status: ReleaseGateStatus;
    rollbackStatus: ReleaseGateStatus;
    checkedAt: number;
    evidenceChecksum: string;
  }>;
  retentionChecksum: string;
}

export interface ReleaseDriftReport {
  version: 'agros-post-release-drift-v1';
  decisionId: string;
  decisionSignature: string;
  stream: string;
  provider: string;
  checkedAt: number;
  status: 'ready' | 'degraded';
  drifted: boolean;
  baselineEvidenceChecksum: string;
  currentEvidenceChecksum: string;
  baselineEvidenceId: string;
  currentMonitorSnapshotId?: string;
  alerts: string[];
  driftChecksum: string;
}

export interface ReleaseBundleSummary {
  version: 'agros-release-bundle-summary-v1';
  generatedAt: number;
  stream: string;
  provider: string;
  decision: ReleaseDecisionRecord;
  evidence: ReleaseEvidenceRecord;
  reconciliation?: ReleaseReconciliationRecord;
  comparison: ReleaseEvidenceComparison;
  drift: ReleaseDriftReport;
  history: ReleaseEvidenceRecord[];
  summary: {
    decisionAccepted: boolean;
    releaseReady: boolean;
    evidenceRetained: number;
    reconciliationState: 'reconciled' | 'missing';
    driftState: ReleaseDriftReport['status'];
    recommendation: string;
  };
  bundleChecksum: string;
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
  return getStorageRepository().releaseEvidence.save(toReleaseEvidenceRecord(report));
}

function toReleaseEvidenceRecord(report: ReleaseReadinessReport): Omit<ReleaseEvidenceRecord, 'createdAt'> {
  const gates = report.gates;
  return {
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
  };
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
  filters: ReleaseEvidenceHistoryFilters = {},
): Promise<ReleaseEvidenceRecord[]> {
  return getStorageRepository().releaseEvidence.getLatest(stream, limit, filters);
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

function normalizedReleaseEvidencePayload(evidence: ReleaseEvidenceRecord): Record<string, unknown> {
  const report = evidence.report as Partial<ReleaseReadinessReport>;
  return {
    stream: evidence.stream,
    status: evidence.status,
    gateCount: evidence.gateCount,
    blockedGateCount: evidence.blockedGateCount,
    degradedGateCount: evidence.degradedGateCount,
    rollbackStatus: evidence.rollbackStatus,
    gates: (report.gates ?? []).map(gate => ({
      name: gate.name,
      status: gate.status,
      detail: gate.detail,
    })),
    recommendations: [...(report.recommendations ?? [])].sort(),
  };
}

export function signReleaseEvidence(evidence: ReleaseEvidenceRecord): {
  evidenceChecksum: string;
  providerSignature: string;
} {
  const evidenceChecksum = hashString(stableStringify(normalizedReleaseEvidencePayload(evidence)));
  const providerSignature = hashString(stableStringify({
    evidenceChecksum,
    evidenceId: evidence.id,
    provider: evidence.provider,
    stream: evidence.stream,
  }));
  return { evidenceChecksum, providerSignature };
}

export async function compareReleaseEvidenceByProvider(
  stream = DEFAULT_REPLAY_STREAM,
  providers: string[] = ['local-docker', 'railway', 'render'],
): Promise<ReleaseEvidenceComparison> {
  const normalizedProviders = providers.map(normalizeProvider);
  const records = await Promise.all(normalizedProviders.map(async provider => {
    const evidence = (await getReleaseEvidenceHistory(stream, 1, { provider }))[0];
    if (!evidence) return { provider, missing: true };
    const signed = signReleaseEvidence(evidence);
    return {
      provider,
      evidenceId: evidence.id,
      status: evidence.status,
      rollbackStatus: evidence.rollbackStatus,
      checkedAt: evidence.checkedAt,
      evidenceChecksum: signed.evidenceChecksum,
      providerSignature: signed.providerSignature,
      missing: false,
    };
  }));
  const presentChecksums = records.flatMap(record => (
    record.evidenceChecksum ? [record.evidenceChecksum] : []
  ));
  const baselineChecksum = presentChecksums[0];

  return {
    stream,
    providers: normalizedProviders,
    comparedAt: Date.now(),
    allMatched: records.every(record => !record.missing)
      && presentChecksums.every(checksum => checksum === baselineChecksum),
    baselineChecksum,
    records,
  };
}

export async function recordReleaseDecision(
  input: ReleaseDecisionInput,
): Promise<ReleaseDecisionRecord> {
  const evidence = await getStorageRepository().releaseEvidence.getById(input.evidenceId);
  if (!evidence) {
    throw new Error(`Release evidence not found: ${input.evidenceId}`);
  }

  const decidedAt = Date.now();
  const { evidenceChecksum, providerSignature } = signReleaseEvidence(evidence);
  const decisionSignature = hashString(stableStringify({
    decidedAt,
    decidedBy: input.decidedBy ?? 'operator',
    decision: input.decision,
    evidenceChecksum,
    evidenceId: evidence.id,
    provider: evidence.provider,
    reason: input.reason,
    stream: evidence.stream,
  }));

  return getStorageRepository().releaseDecisions.save({
    id: `decision_${decisionSignature}`,
    evidenceId: evidence.id,
    stream: evidence.stream,
    provider: evidence.provider,
    decision: input.decision,
    reason: input.reason,
    decidedBy: input.decidedBy ?? 'operator',
    decidedAt,
    evidenceChecksum,
    providerSignature,
    decisionSignature,
  });
}

export async function getReleaseDecisionHistory(
  stream?: string,
  limit = 20,
  filters: { provider?: string; decision?: ReleaseDecisionOutcome } = {},
): Promise<ReleaseDecisionRecord[]> {
  return getStorageRepository().releaseDecisions.getLatest(stream, limit, filters);
}

export async function reconcileReleaseDecision(
  input: ReleaseReconciliationInput,
): Promise<ReleaseReconciliationRecord> {
  const decision = await getStorageRepository().releaseDecisions.getById(input.decisionId);
  if (!decision) {
    throw new Error(`Release decision not found: ${input.decisionId}`);
  }
  const evidence = await getStorageRepository().releaseEvidence.getById(decision.evidenceId);
  if (!evidence) {
    throw new Error(`Release evidence not found: ${decision.evidenceId}`);
  }

  const signed = signReleaseEvidence(evidence);
  if (signed.evidenceChecksum !== decision.evidenceChecksum) {
    throw new Error(`Release decision ${decision.id} does not match evidence checksum ${evidence.id}`);
  }

  const createdAt = Date.now();
  const reconciliationSignature = hashString(stableStringify({
    branch: input.branch,
    commitSha: input.commitSha,
    decisionSignature: decision.decisionSignature,
    evidenceChecksum: signed.evidenceChecksum,
    initiatedBy: input.initiatedBy ?? null,
    pullRequestUrl: input.pullRequestUrl ?? null,
    sourceThread: input.sourceThread ?? null,
  }));

  return getStorageRepository().releaseReconciliations.save({
    id: `reconciliation_${reconciliationSignature}`,
    decisionId: decision.id,
    evidenceId: evidence.id,
    stream: evidence.stream,
    provider: evidence.provider,
    commitSha: input.commitSha,
    branch: input.branch,
    pullRequestUrl: input.pullRequestUrl,
    sourceThread: input.sourceThread,
    initiatedBy: input.initiatedBy,
    decisionSignature: decision.decisionSignature,
    evidenceChecksum: signed.evidenceChecksum,
    providerSignature: signed.providerSignature,
    reconciliationSignature,
    createdAt,
  });
}

export async function getReleaseReconciliationHistory(
  stream?: string,
  limit = 20,
  filters: { provider?: string; decisionId?: string; commitSha?: string } = {},
): Promise<ReleaseReconciliationRecord[]> {
  return getStorageRepository().releaseReconciliations.getLatest(stream, limit, filters);
}

export async function collectPostReleaseDrift(
  decisionId: string,
  options: { persistMonitor?: boolean } = {},
): Promise<ReleaseDriftReport> {
  const decision = await getStorageRepository().releaseDecisions.getById(decisionId);
  if (!decision) {
    throw new Error(`Release decision not found: ${decisionId}`);
  }
  const baselineEvidence = await getStorageRepository().releaseEvidence.getById(decision.evidenceId);
  if (!baselineEvidence) {
    throw new Error(`Release evidence not found: ${decision.evidenceId}`);
  }

  const currentRelease = await collectReleaseReadiness({
    stream: baselineEvidence.stream,
    provider: baselineEvidence.provider,
    persistEvidence: false,
    persistMonitor: options.persistMonitor ?? false,
    includeRollbackPreflight: true,
  });
  const currentEvidence = toReleaseEvidenceRecord(currentRelease);
  const signed = signReleaseEvidence({
    ...currentEvidence,
    createdAt: currentRelease.checkedAt,
  });
  const alerts: string[] = [];
  const drifted = signed.evidenceChecksum !== decision.evidenceChecksum;

  if (drifted) {
    alerts.push('Current release evidence checksum differs from the accepted decision signature.');
  }
  if (currentRelease.status !== 'ready') {
    alerts.push(`Current release gate is ${currentRelease.status}.`);
  }
  if (currentRelease.rollbackPreflight.status !== 'ready') {
    alerts.push(`Current rollback preflight is ${currentRelease.rollbackPreflight.status}.`);
  }

  const checkedAt = Date.now();
  const status = alerts.length ? 'degraded' : 'ready';
  const driftChecksum = hashString(stableStringify({
    alerts,
    baselineEvidenceChecksum: decision.evidenceChecksum,
    currentEvidenceChecksum: signed.evidenceChecksum,
    decisionSignature: decision.decisionSignature,
    status,
  }));

  return {
    version: 'agros-post-release-drift-v1',
    decisionId: decision.id,
    decisionSignature: decision.decisionSignature,
    stream: baselineEvidence.stream,
    provider: baselineEvidence.provider,
    checkedAt,
    status,
    drifted,
    baselineEvidenceChecksum: decision.evidenceChecksum,
    currentEvidenceChecksum: signed.evidenceChecksum,
    baselineEvidenceId: baselineEvidence.id,
    currentMonitorSnapshotId: currentRelease.latestMonitorSnapshot?.id,
    alerts,
    driftChecksum,
  };
}

export async function applyReleaseEvidenceRetention(
  input: ReleaseRetentionInput = {},
): Promise<ReleaseRetentionReport> {
  const stream = input.stream ?? DEFAULT_REPLAY_STREAM;
  const retainLatest = Math.max(1, Math.min(input.retainLatest ?? 50, 500));
  const dryRun = input.dryRun !== false;
  const records = await getReleaseEvidenceHistory(stream, 500, { provider: input.provider });
  const candidates = records.slice(retainLatest);
  const candidateIds = candidates.map(record => record.id);
  const deletedCount = dryRun ? 0 : await getStorageRepository().releaseEvidence.deleteByIds(candidateIds);
  const normalizedCandidates = candidates.map(record => ({
    evidenceId: record.id,
    provider: record.provider,
    status: record.status,
    rollbackStatus: record.rollbackStatus,
    checkedAt: record.checkedAt,
    evidenceChecksum: signReleaseEvidence(record).evidenceChecksum,
  }));
  const retentionChecksum = hashString(stableStringify({
    candidates: normalizedCandidates,
    deletedCount,
    dryRun,
    provider: input.provider ?? null,
    retainLatest,
    stream,
  }));

  return {
    version: 'agros-release-retention-v1',
    stream,
    provider: input.provider,
    retainLatest,
    dryRun,
    evaluatedCount: records.length,
    candidateCount: candidates.length,
    deletedCount,
    candidates: normalizedCandidates,
    retentionChecksum,
  };
}

export async function createReleaseBundleSummary(options: {
  decisionId?: string;
  stream?: string;
  provider?: string;
  limit?: number;
} = {}): Promise<ReleaseBundleSummary> {
  const decision = options.decisionId
    ? await getStorageRepository().releaseDecisions.getById(options.decisionId)
    : (await getReleaseDecisionHistory(options.stream, 1, { provider: options.provider }))[0];

  if (!decision) {
    throw new Error('Release decision is required before creating a bundle summary.');
  }

  const evidence = await getStorageRepository().releaseEvidence.getById(decision.evidenceId);
  if (!evidence) {
    throw new Error(`Release evidence not found: ${decision.evidenceId}`);
  }

  const reconciliation = (await getReleaseReconciliationHistory(evidence.stream, 1, {
    decisionId: decision.id,
    provider: evidence.provider,
  }))[0];
  const comparison = await compareReleaseEvidenceByProvider(evidence.stream, [
    evidence.provider,
    'railway',
    'render',
  ]);
  const drift = await collectPostReleaseDrift(decision.id, { persistMonitor: false });
  const history = await getReleaseEvidenceHistory(evidence.stream, options.limit ?? 8, {
    provider: evidence.provider,
  });
  const releaseReady = decision.decision === 'go' && evidence.status === 'ready' && drift.status === 'ready';
  const recommendation = releaseReady
    ? 'Release decision, baseline evidence, and post-release monitor drift are aligned.'
    : 'Review the release decision, reconciliation metadata, or current drift alerts before promotion.';
  const generatedAt = Date.now();
  const summary = {
    decisionAccepted: decision.decision === 'go',
    releaseReady,
    evidenceRetained: history.length,
    reconciliationState: reconciliation ? 'reconciled' as const : 'missing' as const,
    driftState: drift.status,
    recommendation,
  };
  const bundleChecksum = hashString(stableStringify({
    decisionSignature: decision.decisionSignature,
    driftChecksum: drift.driftChecksum,
    evidenceChecksum: decision.evidenceChecksum,
    generatedAt,
    reconciliationSignature: reconciliation?.reconciliationSignature ?? null,
    summary,
  }));

  return {
    version: 'agros-release-bundle-summary-v1',
    generatedAt,
    stream: evidence.stream,
    provider: evidence.provider,
    decision,
    evidence,
    reconciliation,
    comparison,
    drift,
    history,
    summary,
    bundleChecksum,
  };
}
