import {
  ReleaseDecisionRecord,
  ReleaseDriftOverrideRecord,
  ReleaseEvidenceRecord,
  ReleasePromotionCiCheck,
  ReleasePromotionRecord,
  ReleasePromotionStatus,
  ReleasePromotionTimelineEntry,
  ReleaseRollbackRecord,
  ReleaseRollbackStatus,
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
  environment?: ReleaseEnvironment;
  policy?: ReleaseRetentionPolicyName;
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

export type ReleaseEnvironment = 'local' | 'staging' | 'production';
export type ReleaseRetentionPolicyName = 'local' | 'staging' | 'production';
export type ReleaseStatusTone = 'success' | 'warning' | 'danger';

export interface ReleaseRetentionPolicyPreset {
  name: ReleaseRetentionPolicyName;
  environment: ReleaseEnvironment;
  retainLatest: number;
  dryRunDefault: boolean;
  description: string;
}

export interface ReleaseDriftOverrideInput {
  decisionId: string;
  environment?: ReleaseEnvironment;
  driftChecksum: string;
  reason: string;
  overriddenBy?: string;
}

export interface ReleaseSupervisionCardAction {
  type: 'prompt_run';
  actionId: string;
  label: string;
  prompt: string;
  style?: 'primary' | 'danger';
}

export interface ReleaseSupervisionStatusCard {
  version: 'agros-release-supervision-card-v1';
  title: string;
  statusLabel: string;
  statusTone: ReleaseStatusTone;
  summary: string;
  environment: ReleaseEnvironment;
  decisionId: string;
  bundle: ReleaseBundleSummary;
  retentionPolicy: ReleaseRetentionPolicyPreset;
  latestOverride?: ReleaseDriftOverrideRecord;
  sections: Array<{ title: string; body: string }>;
  facts: Array<{ label: string; value: string }>;
  links: Array<{ label: string; url: string }>;
  actions: ReleaseSupervisionCardAction[];
  exampleReplies: Array<{ actionId: string; label: string; reply: string }>;
  cardChecksum: string;
}

export interface ReleaseDeploymentCommandDescriptor {
  id: string;
  label: string;
  environment: ReleaseEnvironment;
  command: string;
  description: string;
  guardedBy: 'ReleaseSupervisionCard';
  requiredDecision: ReleaseDecisionOutcome;
  requiredStatusLabels: string[];
  requiredEnvironmentVariables: string[];
}

export interface ReleasePromotionInput {
  decisionId: string;
  environment?: ReleaseEnvironment;
  commandId?: string;
  actor?: string;
}

export interface ReleasePromotionTransitionInput {
  promotionId: string;
  status: ReleasePromotionStatus;
  actor?: string;
  detail?: string;
  outcome?: ReleasePromotionRecord['outcome'];
}

export interface ReleasePromotionCiCheckInput {
  promotionId: string;
  name: string;
  status: ReleasePromotionCiCheck['status'];
  url?: string;
  detail?: string;
}

export interface ReleasePromotionTimelineExport {
  version: 'agros-release-promotion-timeline-v1';
  exportedAt: number;
  promotion: ReleasePromotionRecord;
  supervisionCard: ReleaseSupervisionStatusCard;
  timeline: ReleasePromotionTimelineEntry[];
  ciChecks: ReleasePromotionCiCheck[];
  exportChecksum: string;
}

export interface ReleaseRollbackCommandDescriptor {
  id: string;
  label: string;
  environment: ReleaseEnvironment;
  command: string;
  description: string;
  guardedBy: 'ReleasePromotionTimeline';
  requiredPromotionStates: ReleasePromotionStatus[];
  requiredTimelineSignals: string[];
  requiredEnvironmentVariables: string[];
}

export interface ReleaseRollbackInput {
  promotionId: string;
  environment?: ReleaseEnvironment;
  commandId?: string;
  actor?: string;
}

export interface ReleaseRollbackTransitionInput {
  rollbackId: string;
  status: ReleaseRollbackStatus;
  actor?: string;
  detail?: string;
  outcome?: ReleaseRollbackRecord['outcome'];
}

export interface ReleaseRollbackCiCheckInput {
  rollbackId: string;
  name: string;
  status: ReleasePromotionCiCheck['status'];
  url?: string;
  detail?: string;
}

export interface ReleaseRollbackTimelineExport {
  version: 'agros-release-rollback-timeline-v1';
  exportedAt: number;
  rollback: ReleaseRollbackRecord;
  promotionTimeline: ReleasePromotionTimelineExport;
  timeline: ReleasePromotionTimelineEntry[];
  ciChecks: ReleasePromotionCiCheck[];
  exportChecksum: string;
}

export type ReleaseHandoffArtifactKind =
  | 'release_evidence'
  | 'release_bundle_summary'
  | 'promotion_timeline'
  | 'rollback_timeline';

export interface ReleaseHandoffArtifactRef {
  kind: ReleaseHandoffArtifactKind;
  artifactId: string;
  version: string;
  checksum: string;
  signature: string;
  sourceId: string;
  required: boolean;
  generatedAt?: number;
  status?: string;
}

export interface ReleaseEvidenceBundleManifest {
  version: 'agros-release-evidence-manifest-v1';
  generatedAt: number;
  stream: string;
  provider: string;
  decisionId: string;
  evidenceId: string;
  promotionId?: string;
  rollbackId?: string;
  artifacts: ReleaseHandoffArtifactRef[];
  missingArtifacts: ReleaseHandoffArtifactKind[];
  manifestChecksum: string;
  manifestSignature: string;
  triage: {
    status: 'ready' | 'degraded';
    summary: string;
    recommendations: string[];
  };
}

export interface ReleaseArtifactVerificationInput {
  manifest: ReleaseEvidenceBundleManifest;
  artifacts?: Partial<Record<ReleaseHandoffArtifactKind, unknown>>;
}

export interface ReleaseArtifactVerificationReport {
  version: 'agros-release-artifact-verification-v1';
  verifiedAt: number;
  status: 'ready' | 'degraded' | 'blocked';
  manifestChecksum: string;
  computedManifestChecksum: string;
  manifestSignature: string;
  signatureMatched: boolean;
  artifacts: Array<{
    kind: ReleaseHandoffArtifactKind;
    artifactId: string;
    expectedChecksum: string;
    actualChecksum?: string;
    matched: boolean;
    detail: string;
  }>;
  mismatches: string[];
  recommendations: string[];
}

export type ReleaseIncidentPacketVisibility = 'public' | 'private';

export interface ReleaseIncidentPacketInput {
  decisionId?: string;
  stream?: string;
  provider?: string;
  promotionId?: string;
  rollbackId?: string;
  owner?: string;
  visibility?: ReleaseIncidentPacketVisibility;
  limit?: number;
  verification?: ReleaseArtifactVerificationReport;
}

export interface ReleaseIncidentPacketRedaction {
  path: string;
  reason: string;
}

export interface ReleaseIncidentPacketExport {
  version: 'agros-release-incident-packet-v1';
  generatedAt: number;
  visibility: ReleaseIncidentPacketVisibility;
  owner: string;
  stream: string;
  provider: string;
  decisionId: string;
  evidenceId: string;
  promotionId?: string;
  rollbackId?: string;
  manifest: ReleaseEvidenceBundleManifest;
  verification: ReleaseArtifactVerificationReport;
  drift: ReleaseDriftReport;
  bundleSummary: ReleaseBundleSummary | Record<string, unknown>;
  promotionTimeline?: ReleasePromotionTimelineExport;
  rollbackTimeline?: ReleaseRollbackTimelineExport;
  redactions: ReleaseIncidentPacketRedaction[];
  summary: {
    status: ReleaseGateStatus;
    recommendation: string;
    artifactStatus: ReleaseArtifactVerificationReport['status'];
    driftStatus: ReleaseDriftReport['status'];
    rollbackStatus: ReleaseRollbackStatus | 'missing';
  };
  packetChecksum: string;
}

const PROVIDERS = new Set(['local-docker', 'railway', 'render', 'custom']);

const RELEASE_RETENTION_POLICY_PRESETS: Record<ReleaseRetentionPolicyName, ReleaseRetentionPolicyPreset> = {
  local: {
    name: 'local',
    environment: 'local',
    retainLatest: 20,
    dryRunDefault: true,
    description: 'Keep a compact local evidence window for developer smoke checks.',
  },
  staging: {
    name: 'staging',
    environment: 'staging',
    retainLatest: 75,
    dryRunDefault: true,
    description: 'Keep enough staging evidence for cross-provider promotion review.',
  },
  production: {
    name: 'production',
    environment: 'production',
    retainLatest: 250,
    dryRunDefault: true,
    description: 'Keep the long production audit trail and require explicit non-dry-run cleanup.',
  },
};

function normalizeProvider(provider?: string): ReleaseProvider {
  const candidate = (provider || 'local-docker').trim().toLowerCase();
  return PROVIDERS.has(candidate) ? candidate as ReleaseProvider : 'custom';
}

function normalizeEnvironment(environment?: string): ReleaseEnvironment {
  const candidate = (environment || 'staging').trim().toLowerCase();
  if (candidate === 'local' || candidate === 'production') return candidate;
  return 'staging';
}

function resolveRetentionPolicy(
  policy?: ReleaseRetentionPolicyName,
  environment?: ReleaseEnvironment,
): ReleaseRetentionPolicyPreset {
  if (policy && RELEASE_RETENTION_POLICY_PRESETS[policy]) {
    return RELEASE_RETENTION_POLICY_PRESETS[policy];
  }
  return RELEASE_RETENTION_POLICY_PRESETS[environment ?? 'staging'];
}

export function getReleaseRetentionPolicyPresets(): ReleaseRetentionPolicyPreset[] {
  return Object.values(RELEASE_RETENTION_POLICY_PRESETS);
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
  const environment = normalizeEnvironment(input.environment);
  const policy = resolveRetentionPolicy(input.policy, environment);
  const retainLatest = Math.max(1, Math.min(input.retainLatest ?? policy.retainLatest, 500));
  const dryRun = input.dryRun ?? policy.dryRunDefault;
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

export async function recordReleaseDriftOverride(
  input: ReleaseDriftOverrideInput,
): Promise<ReleaseDriftOverrideRecord> {
  const decision = await getStorageRepository().releaseDecisions.getById(input.decisionId);
  if (!decision) {
    throw new Error(`Release decision not found: ${input.decisionId}`);
  }
  const evidence = await getStorageRepository().releaseEvidence.getById(decision.evidenceId);
  if (!evidence) {
    throw new Error(`Release evidence not found: ${decision.evidenceId}`);
  }
  const environment = normalizeEnvironment(input.environment);
  const drift = await collectPostReleaseDrift(decision.id, { persistMonitor: false });
  if (drift.driftChecksum !== input.driftChecksum) {
    throw new Error(`Drift checksum mismatch for decision ${decision.id}`);
  }

  const createdAt = Date.now();
  const overrideSignature = hashString(stableStringify({
    decisionSignature: decision.decisionSignature,
    driftChecksum: drift.driftChecksum,
    environment,
    overriddenBy: input.overriddenBy ?? 'operator',
    reason: input.reason,
  }));

  return getStorageRepository().releaseDriftOverrides.save({
    id: `drift_override_${overrideSignature}`,
    decisionId: decision.id,
    evidenceId: evidence.id,
    stream: evidence.stream,
    provider: evidence.provider,
    environment,
    driftChecksum: drift.driftChecksum,
    decisionSignature: decision.decisionSignature,
    reason: input.reason,
    overriddenBy: input.overriddenBy ?? 'operator',
    overrideSignature,
    createdAt,
  });
}

export async function getReleaseDriftOverrideHistory(
  stream?: string,
  limit = 20,
  filters: { provider?: string; decisionId?: string; environment?: ReleaseEnvironment } = {},
): Promise<ReleaseDriftOverrideRecord[]> {
  return getStorageRepository().releaseDriftOverrides.getLatest(stream, limit, filters);
}

export async function createReleaseSupervisionStatusCard(options: {
  decisionId: string;
  environment?: ReleaseEnvironment;
  policy?: ReleaseRetentionPolicyName;
}): Promise<ReleaseSupervisionStatusCard> {
  const environment = normalizeEnvironment(options.environment);
  const retentionPolicy = resolveRetentionPolicy(options.policy, environment);
  const bundle = await createReleaseBundleSummary({ decisionId: options.decisionId, limit: 8 });
  const latestOverride = (await getReleaseDriftOverrideHistory(bundle.stream, 1, {
    decisionId: bundle.decision.id,
    provider: bundle.provider,
    environment,
  }))[0];
  const driftRequiresReview = bundle.drift.status !== 'ready' && !latestOverride;
  const releaseBlocked = bundle.decision.decision === 'no-go' || bundle.evidence.status === 'blocked';
  const statusLabel = releaseBlocked
    ? 'Blocked'
    : driftRequiresReview
      ? 'Drift Review'
      : bundle.summary.releaseReady || latestOverride
        ? 'Supervised'
        : 'Needs Review';
  const statusTone: ReleaseStatusTone = releaseBlocked
    ? 'danger'
    : statusLabel === 'Drift Review' || statusLabel === 'Needs Review'
      ? 'warning'
      : 'success';
  const links = bundle.reconciliation?.pullRequestUrl
    ? [{ label: 'Pull Request', url: bundle.reconciliation.pullRequestUrl }]
    : [];
  const actions: ReleaseSupervisionCardAction[] = [
    {
      type: 'prompt_run',
      actionId: 'refresh_release_supervision',
      label: 'Refresh Status',
      prompt: `Refresh release supervision for decision ${bundle.decision.id} in ${environment}.`,
      style: 'primary',
    },
    {
      type: 'prompt_run',
      actionId: 'publish_bundle_summary',
      label: 'Publish Bundle',
      prompt: `Publish the release bundle summary for decision ${bundle.decision.id} in ${environment}.`,
    },
    {
      type: 'prompt_run',
      actionId: 'record_drift_exception',
      label: 'Record Drift Exception',
      prompt: `Record an operator drift exception for decision ${bundle.decision.id} using drift checksum ${bundle.drift.driftChecksum}.`,
      style: 'danger',
    },
  ];
  const cardChecksum = hashString(stableStringify({
    bundleChecksum: bundle.bundleChecksum,
    driftChecksum: bundle.drift.driftChecksum,
    environment,
    latestOverrideSignature: latestOverride?.overrideSignature ?? null,
    retentionPolicy: retentionPolicy.name,
    statusLabel,
  }));

  return {
    version: 'agros-release-supervision-card-v1',
    title: `Release supervision: ${environment}`,
    statusLabel,
    statusTone,
    summary: latestOverride
      ? `Drift exception recorded by ${latestOverride.overriddenBy}; continue with operator review.`
      : bundle.summary.recommendation,
    environment,
    decisionId: bundle.decision.id,
    bundle,
    retentionPolicy,
    latestOverride,
    sections: [
      {
        title: 'Decision',
        body: `${bundle.decision.decision} by ${bundle.decision.decidedBy}: ${bundle.decision.reason}`,
      },
      {
        title: 'Drift',
        body: bundle.drift.alerts.length ? bundle.drift.alerts.join(' ') : 'No post-release drift alerts are active.',
      },
      {
        title: 'Retention',
        body: `${retentionPolicy.description} Retain latest ${retentionPolicy.retainLatest} evidence records by default.`,
      },
    ],
    facts: [
      { label: 'Environment', value: environment },
      { label: 'Provider', value: bundle.provider },
      { label: 'Decision signature', value: bundle.decision.decisionSignature },
      { label: 'Bundle checksum', value: bundle.bundleChecksum },
      { label: 'Drift checksum', value: bundle.drift.driftChecksum },
      { label: 'Retention policy', value: retentionPolicy.name },
    ],
    links,
    actions,
    exampleReplies: [
      {
        actionId: 'refresh_release_supervision',
        label: 'Refresh Status',
        reply: 'Release supervision refreshed and the status card now reflects the latest drift and bundle state.',
      },
      {
        actionId: 'publish_bundle_summary',
        label: 'Publish Bundle',
        reply: 'Release bundle summary published with the current bundle checksum and reconciliation metadata.',
      },
      {
        actionId: 'record_drift_exception',
        label: 'Record Drift Exception',
        reply: 'Drift exception recorded. The release remains operator-supervised until a clean drift check passes.',
      },
    ],
    cardChecksum,
  };
}

const RELEASE_DEPLOYMENT_COMMANDS: Record<ReleaseEnvironment, ReleaseDeploymentCommandDescriptor[]> = {
  local: [
    {
      id: 'validate_local_release',
      label: 'Validate Local Release',
      environment: 'local',
      command: 'npm run validate:phase11',
      description: 'Run the local deterministic release supervision validation before promotion.',
      guardedBy: 'ReleaseSupervisionCard',
      requiredDecision: 'go',
      requiredStatusLabels: ['Supervised'],
      requiredEnvironmentVariables: [],
    },
  ],
  staging: [
    {
      id: 'publish_staging_bundle',
      label: 'Publish Staging Bundle',
      environment: 'staging',
      command: 'npm run artifact:release-bundle -- --environment=staging',
      description: 'Publish the staging release supervision bundle after the card is supervised.',
      guardedBy: 'ReleaseSupervisionCard',
      requiredDecision: 'go',
      requiredStatusLabels: ['Supervised'],
      requiredEnvironmentVariables: ['AGROS_RELEASE_DECISION_ID'],
    },
  ],
  production: [
    {
      id: 'publish_production_bundle',
      label: 'Publish Production Bundle',
      environment: 'production',
      command: 'npm run artifact:release-bundle -- --environment=production',
      description: 'Publish the production release supervision bundle under explicit operator approval.',
      guardedBy: 'ReleaseSupervisionCard',
      requiredDecision: 'go',
      requiredStatusLabels: ['Supervised'],
      requiredEnvironmentVariables: ['AGROS_RELEASE_DECISION_ID'],
    },
  ],
};

export function getReleaseDeploymentCommandDescriptors(
  environment?: ReleaseEnvironment,
): ReleaseDeploymentCommandDescriptor[] {
  const normalized = normalizeEnvironment(environment);
  return RELEASE_DEPLOYMENT_COMMANDS[normalized];
}

function promotionTimelineEvent(
  type: string,
  detail: string,
  actor?: string,
  at = Date.now(),
): ReleasePromotionTimelineEntry {
  return {
    type,
    at,
    actor,
    detail,
    checksum: hashString(stableStringify({ actor: actor ?? null, at, detail, type })),
  };
}

function normalizePromotionStatus(status: ReleasePromotionStatus): ReleasePromotionStatus {
  if (['started', 'stopped', 'approved', 'rejected', 'deployed', 'failed'].includes(status)) {
    return status;
  }
  return 'started';
}

export async function startReleasePromotion(
  input: ReleasePromotionInput,
): Promise<ReleasePromotionRecord> {
  const environment = normalizeEnvironment(input.environment);
  const card = await createReleaseSupervisionStatusCard({
    decisionId: input.decisionId,
    environment,
    policy: environment,
  });
  if (card.bundle.decision.decision !== 'go') {
    throw new Error(`Release promotion requires a go decision: ${card.bundle.decision.id}`);
  }
  const commands = getReleaseDeploymentCommandDescriptors(environment);
  const command = commands.find(item => item.id === input.commandId) ?? commands[0];
  if (!command.requiredStatusLabels.includes(card.statusLabel)) {
    throw new Error(`Release supervision card is ${card.statusLabel}; ${command.label} requires ${command.requiredStatusLabels.join(', ')}`);
  }

  const startedAt = Date.now();
  const promotionSignature = hashString(stableStringify({
    cardChecksum: card.cardChecksum,
    commandId: command.id,
    decisionSignature: card.bundle.decision.decisionSignature,
    environment,
    startedAt,
  }));
  const timeline = [
    promotionTimelineEvent(
      'promotion_started',
      `${command.label} guarded by release supervision card ${card.cardChecksum}`,
      input.actor ?? 'operator',
      startedAt,
    ),
  ];

  return getStorageRepository().releasePromotions.save({
    id: `promotion_${promotionSignature}`,
    decisionId: card.bundle.decision.id,
    evidenceId: card.bundle.evidence.id,
    stream: card.bundle.stream,
    provider: card.bundle.provider,
    environment,
    status: 'started',
    startedAt,
    commandId: command.id,
    commandLabel: command.label,
    supervisionCardChecksum: card.cardChecksum,
    promotionSignature,
    timeline,
    ciChecks: [],
  });
}

export async function getReleasePromotionHistory(
  stream?: string,
  limit = 20,
  filters: {
    provider?: string;
    decisionId?: string;
    environment?: ReleaseEnvironment;
    status?: ReleasePromotionStatus;
  } = {},
): Promise<ReleasePromotionRecord[]> {
  return getStorageRepository().releasePromotions.getLatest(stream, limit, filters);
}

export async function transitionReleasePromotion(
  input: ReleasePromotionTransitionInput,
): Promise<ReleasePromotionRecord> {
  const promotion = await getStorageRepository().releasePromotions.getById(input.promotionId);
  if (!promotion) {
    throw new Error(`Release promotion not found: ${input.promotionId}`);
  }
  const now = Date.now();
  const status = normalizePromotionStatus(input.status);
  const detail = input.detail ?? `Promotion ${promotion.id} moved to ${status}.`;
  const next: ReleasePromotionRecord = {
    ...promotion,
    status,
    stoppedAt: status === 'stopped' ? now : promotion.stoppedAt,
    approvedAt: status === 'approved' ? now : promotion.approvedAt,
    approvedBy: status === 'approved' ? input.actor ?? 'operator' : promotion.approvedBy,
    outcomeAt: status === 'deployed' || status === 'failed' || status === 'rejected' ? now : promotion.outcomeAt,
    outcome: input.outcome ?? (
      status === 'deployed'
        ? 'succeeded'
        : status === 'failed'
          ? 'failed'
          : status === 'stopped' || status === 'rejected'
            ? 'cancelled'
            : promotion.outcome
    ),
    timeline: [
      ...promotion.timeline,
      promotionTimelineEvent(`promotion_${status}`, detail, input.actor ?? 'operator', now),
    ],
    updatedAt: now,
  };

  return getStorageRepository().releasePromotions.save(next);
}

export async function attachReleasePromotionCiCheck(
  input: ReleasePromotionCiCheckInput,
): Promise<ReleasePromotionRecord> {
  const promotion = await getStorageRepository().releasePromotions.getById(input.promotionId);
  if (!promotion) {
    throw new Error(`Release promotion not found: ${input.promotionId}`);
  }
  const checkedAt = Date.now();
  const ciCheck: ReleasePromotionCiCheck = {
    name: input.name,
    status: input.status,
    url: input.url,
    detail: input.detail,
    checkedAt,
    checksum: hashString(stableStringify({
      checkedAt,
      detail: input.detail ?? null,
      name: input.name,
      status: input.status,
      url: input.url ?? null,
    })),
  };
  const next: ReleasePromotionRecord = {
    ...promotion,
    ciChecks: [...promotion.ciChecks, ciCheck],
    timeline: [
      ...promotion.timeline,
      promotionTimelineEvent('ci_check_attached', `${input.name} reported ${input.status}.`, 'ci-monitor', checkedAt),
    ],
    updatedAt: checkedAt,
  };

  return getStorageRepository().releasePromotions.save(next);
}

export async function exportReleasePromotionTimeline(
  promotionId: string,
): Promise<ReleasePromotionTimelineExport> {
  const promotion = await getStorageRepository().releasePromotions.getById(promotionId);
  if (!promotion) {
    throw new Error(`Release promotion not found: ${promotionId}`);
  }
  const supervisionCard = await createReleaseSupervisionStatusCard({
    decisionId: promotion.decisionId,
    environment: promotion.environment,
    policy: promotion.environment,
  });
  const exportedAt = Date.now();
  const exportChecksum = hashString(stableStringify({
    ciChecks: promotion.ciChecks.map(check => check.checksum),
    exportedAt,
    promotionSignature: promotion.promotionSignature,
    status: promotion.status,
    supervisionCardChecksum: supervisionCard.cardChecksum,
    timeline: promotion.timeline.map(event => event.checksum),
  }));

  return {
    version: 'agros-release-promotion-timeline-v1',
    exportedAt,
    promotion,
    supervisionCard,
    timeline: promotion.timeline,
    ciChecks: promotion.ciChecks,
    exportChecksum,
  };
}

const RELEASE_ROLLBACK_COMMANDS: Record<ReleaseEnvironment, ReleaseRollbackCommandDescriptor[]> = {
  local: [
    {
      id: 'rehearse_local_rollback',
      label: 'Rehearse Local Rollback',
      environment: 'local',
      command: 'npm run validate:phase12',
      description: 'Rehearse rollback handling locally against the latest promotion timeline.',
      guardedBy: 'ReleasePromotionTimeline',
      requiredPromotionStates: ['failed', 'deployed'],
      requiredTimelineSignals: ['promotion_failed', 'ci_check_attached'],
      requiredEnvironmentVariables: ['AGROS_RELEASE_PROMOTION_ID'],
    },
  ],
  staging: [
    {
      id: 'rehearse_staging_rollback',
      label: 'Rehearse Staging Rollback',
      environment: 'staging',
      command: 'npm run artifact:promotion-timeline -- --promotion-id=$AGROS_RELEASE_PROMOTION_ID',
      description: 'Export and review the staging promotion timeline before rollback execution.',
      guardedBy: 'ReleasePromotionTimeline',
      requiredPromotionStates: ['failed', 'deployed'],
      requiredTimelineSignals: ['promotion_failed', 'ci_check_attached'],
      requiredEnvironmentVariables: ['AGROS_RELEASE_PROMOTION_ID'],
    },
  ],
  production: [
    {
      id: 'execute_production_rollback',
      label: 'Execute Production Rollback',
      environment: 'production',
      command: 'npm run artifact:rollback-timeline -- --rollback-id=$AGROS_RELEASE_ROLLBACK_ID',
      description: 'Execute the supervised production rollback handoff and export the rollback timeline.',
      guardedBy: 'ReleasePromotionTimeline',
      requiredPromotionStates: ['failed'],
      requiredTimelineSignals: ['promotion_failed', 'ci_check_attached'],
      requiredEnvironmentVariables: ['AGROS_RELEASE_PROMOTION_ID', 'AGROS_RELEASE_ROLLBACK_ID'],
    },
  ],
};

export function getReleaseRollbackCommandDescriptors(
  environment?: ReleaseEnvironment,
): ReleaseRollbackCommandDescriptor[] {
  const normalized = normalizeEnvironment(environment);
  return RELEASE_ROLLBACK_COMMANDS[normalized];
}

function promotionTimelineIsRollbackEligible(timeline: ReleasePromotionTimelineExport): boolean {
  return timeline.promotion.status === 'failed'
    || timeline.promotion.outcome === 'failed'
    || timeline.ciChecks.some(check => check.status === 'failed')
    || timeline.timeline.some(event => event.type === 'promotion_failed');
}

function normalizeRollbackStatus(status: ReleaseRollbackStatus): ReleaseRollbackStatus {
  if (['planned', 'approved', 'rehearsed', 'executed', 'failed', 'cancelled'].includes(status)) {
    return status;
  }
  return 'planned';
}

export async function planReleaseRollback(
  input: ReleaseRollbackInput,
): Promise<ReleaseRollbackRecord> {
  const promotionTimeline = await exportReleasePromotionTimeline(input.promotionId);
  if (!promotionTimelineIsRollbackEligible(promotionTimeline)) {
    throw new Error(`Promotion ${input.promotionId} is not failed or degraded enough for rollback planning.`);
  }
  const environment = normalizeEnvironment(input.environment ?? promotionTimeline.promotion.environment);
  const commands = getReleaseRollbackCommandDescriptors(environment);
  const command = commands.find(item => item.id === input.commandId) ?? commands[0];
  if (
    !command.requiredPromotionStates.includes(promotionTimeline.promotion.status)
    && !promotionTimeline.ciChecks.some(check => check.status === 'failed')
  ) {
    throw new Error(`Rollback command ${command.label} is guarded by ${command.requiredPromotionStates.join(', ')} promotion states.`);
  }

  const plannedAt = Date.now();
  const rollbackSignature = hashString(stableStringify({
    commandId: command.id,
    environment,
    plannedAt,
    promotionId: promotionTimeline.promotion.id,
    promotionSignature: promotionTimeline.promotion.promotionSignature,
    promotionTimelineChecksum: promotionTimeline.exportChecksum,
  }));
  const timeline = [
    promotionTimelineEvent(
      'rollback_planned',
      `${command.label} linked to promotion timeline ${promotionTimeline.exportChecksum}`,
      input.actor ?? 'operator',
      plannedAt,
    ),
  ];

  return getStorageRepository().releaseRollbacks.save({
    id: `rollback_${rollbackSignature}`,
    promotionId: promotionTimeline.promotion.id,
    decisionId: promotionTimeline.promotion.decisionId,
    evidenceId: promotionTimeline.promotion.evidenceId,
    stream: promotionTimeline.promotion.stream,
    provider: promotionTimeline.promotion.provider,
    environment,
    status: 'planned',
    plannedAt,
    commandId: command.id,
    commandLabel: command.label,
    promotionTimelineChecksum: promotionTimeline.exportChecksum,
    rollbackSignature,
    timeline,
    ciChecks: [],
  });
}

export async function getReleaseRollbackHistory(
  stream?: string,
  limit = 20,
  filters: {
    provider?: string;
    promotionId?: string;
    decisionId?: string;
    environment?: ReleaseEnvironment;
    status?: ReleaseRollbackStatus;
  } = {},
): Promise<ReleaseRollbackRecord[]> {
  return getStorageRepository().releaseRollbacks.getLatest(stream, limit, filters);
}

export async function transitionReleaseRollback(
  input: ReleaseRollbackTransitionInput,
): Promise<ReleaseRollbackRecord> {
  const rollback = await getStorageRepository().releaseRollbacks.getById(input.rollbackId);
  if (!rollback) {
    throw new Error(`Release rollback not found: ${input.rollbackId}`);
  }
  const now = Date.now();
  const status = normalizeRollbackStatus(input.status);
  const detail = input.detail ?? `Rollback ${rollback.id} moved to ${status}.`;
  const next: ReleaseRollbackRecord = {
    ...rollback,
    status,
    approvedAt: status === 'approved' ? now : rollback.approvedAt,
    approvedBy: status === 'approved' ? input.actor ?? 'operator' : rollback.approvedBy,
    outcomeAt: status === 'executed' || status === 'failed' || status === 'cancelled' ? now : rollback.outcomeAt,
    outcome: input.outcome ?? (
      status === 'executed'
        ? 'succeeded'
        : status === 'failed'
          ? 'failed'
          : status === 'cancelled'
            ? 'cancelled'
            : rollback.outcome
    ),
    timeline: [
      ...rollback.timeline,
      promotionTimelineEvent(`rollback_${status}`, detail, input.actor ?? 'operator', now),
    ],
    updatedAt: now,
  };

  return getStorageRepository().releaseRollbacks.save(next);
}

export async function attachReleaseRollbackCiCheck(
  input: ReleaseRollbackCiCheckInput,
): Promise<ReleaseRollbackRecord> {
  const rollback = await getStorageRepository().releaseRollbacks.getById(input.rollbackId);
  if (!rollback) {
    throw new Error(`Release rollback not found: ${input.rollbackId}`);
  }
  const checkedAt = Date.now();
  const ciCheck: ReleasePromotionCiCheck = {
    name: input.name,
    status: input.status,
    url: input.url,
    detail: input.detail,
    checkedAt,
    checksum: hashString(stableStringify({
      checkedAt,
      detail: input.detail ?? null,
      name: input.name,
      status: input.status,
      url: input.url ?? null,
    })),
  };
  const next: ReleaseRollbackRecord = {
    ...rollback,
    ciChecks: [...rollback.ciChecks, ciCheck],
    timeline: [
      ...rollback.timeline,
      promotionTimelineEvent('rollback_ci_check_attached', `${input.name} reported ${input.status}.`, 'ci-monitor', checkedAt),
    ],
    updatedAt: checkedAt,
  };

  return getStorageRepository().releaseRollbacks.save(next);
}

export async function exportReleaseRollbackTimeline(
  rollbackId: string,
): Promise<ReleaseRollbackTimelineExport> {
  const rollback = await getStorageRepository().releaseRollbacks.getById(rollbackId);
  if (!rollback) {
    throw new Error(`Release rollback not found: ${rollbackId}`);
  }
  const promotionTimeline = await exportReleasePromotionTimeline(rollback.promotionId);
  const exportedAt = Date.now();
  const exportChecksum = hashString(stableStringify({
    ciChecks: rollback.ciChecks.map(check => check.checksum),
    exportedAt,
    promotionTimelineChecksum: promotionTimeline.exportChecksum,
    rollbackSignature: rollback.rollbackSignature,
    status: rollback.status,
    timeline: rollback.timeline.map(event => event.checksum),
  }));

  return {
    version: 'agros-release-rollback-timeline-v1',
    exportedAt,
    rollback,
    promotionTimeline,
    timeline: rollback.timeline,
    ciChecks: rollback.ciChecks,
    exportChecksum,
  };
}

function signHandoffArtifact(
  kind: ReleaseHandoffArtifactKind,
  checksum: string,
  sourceSignature?: string,
): string {
  return hashString(stableStringify({
    checksum,
    kind,
    sourceSignature: sourceSignature ?? null,
  }));
}

function manifestChecksumPayload(
  manifest: Omit<ReleaseEvidenceBundleManifest, 'manifestChecksum' | 'manifestSignature'>,
): Record<string, unknown> {
  return {
    artifacts: manifest.artifacts.map(artifact => ({
      artifactId: artifact.artifactId,
      checksum: artifact.checksum,
      kind: artifact.kind,
      required: artifact.required,
      signature: artifact.signature,
      sourceId: artifact.sourceId,
      status: artifact.status ?? null,
      version: artifact.version,
    })),
    decisionId: manifest.decisionId,
    evidenceId: manifest.evidenceId,
    generatedAt: manifest.generatedAt,
    missingArtifacts: manifest.missingArtifacts,
    promotionId: manifest.promotionId ?? null,
    provider: manifest.provider,
    rollbackId: manifest.rollbackId ?? null,
    stream: manifest.stream,
    triage: manifest.triage,
    version: manifest.version,
  };
}

function signManifest(checksum: string, decisionId: string): string {
  return hashString(stableStringify({
    checksum,
    decisionId,
    version: 'agros-release-evidence-manifest-v1',
  }));
}

function releaseEvidenceArtifactRef(evidence: ReleaseEvidenceRecord): ReleaseHandoffArtifactRef {
  const signed = signReleaseEvidence(evidence);
  return {
    kind: 'release_evidence',
    artifactId: evidence.id,
    version: 'agros-release-evidence-record-v1',
    checksum: signed.evidenceChecksum,
    signature: signed.providerSignature,
    sourceId: evidence.id,
    required: true,
    generatedAt: evidence.checkedAt,
    status: evidence.status,
  };
}

function stableReleaseBundleChecksum(bundle: Pick<ReleaseBundleSummary, 'decision' | 'drift' | 'evidence' | 'reconciliation' | 'summary'>): string {
  return hashString(stableStringify({
    decisionSignature: bundle.decision.decisionSignature,
    driftChecksum: bundle.drift.driftChecksum,
    evidenceChecksum: bundle.decision.evidenceChecksum,
    evidenceId: bundle.evidence.id,
    reconciliationSignature: bundle.reconciliation?.reconciliationSignature ?? null,
    summary: bundle.summary,
  }));
}

function stablePromotionTimelineChecksum(
  timeline: Pick<ReleasePromotionTimelineExport, 'promotion' | 'timeline' | 'ciChecks'>,
): string {
  return hashString(stableStringify({
    ciChecks: timeline.ciChecks.map(check => check.checksum),
    promotionSignature: timeline.promotion.promotionSignature,
    status: timeline.promotion.status,
    supervisionCardChecksum: timeline.promotion.supervisionCardChecksum,
    timeline: timeline.timeline.map(event => event.checksum),
  }));
}

function stableRollbackTimelineChecksum(
  timeline: Pick<ReleaseRollbackTimelineExport, 'rollback' | 'timeline' | 'ciChecks'>,
): string {
  return hashString(stableStringify({
    ciChecks: timeline.ciChecks.map(check => check.checksum),
    promotionTimelineChecksum: timeline.rollback.promotionTimelineChecksum,
    rollbackSignature: timeline.rollback.rollbackSignature,
    status: timeline.rollback.status,
    timeline: timeline.timeline.map(event => event.checksum),
  }));
}

function releaseBundleArtifactRef(bundle: ReleaseBundleSummary): ReleaseHandoffArtifactRef {
  const checksum = stableReleaseBundleChecksum(bundle);
  return {
    kind: 'release_bundle_summary',
    artifactId: bundle.decision.id,
    version: bundle.version,
    checksum,
    signature: signHandoffArtifact('release_bundle_summary', checksum, bundle.decision.decisionSignature),
    sourceId: bundle.decision.id,
    required: true,
    generatedAt: bundle.generatedAt,
    status: bundle.summary.releaseReady ? 'ready' : 'degraded',
  };
}

function promotionTimelineArtifactRef(timeline: ReleasePromotionTimelineExport): ReleaseHandoffArtifactRef {
  const checksum = stablePromotionTimelineChecksum(timeline);
  return {
    kind: 'promotion_timeline',
    artifactId: timeline.promotion.id,
    version: timeline.version,
    checksum,
    signature: signHandoffArtifact('promotion_timeline', checksum, timeline.promotion.promotionSignature),
    sourceId: timeline.promotion.id,
    required: true,
    generatedAt: timeline.exportedAt,
    status: timeline.promotion.status,
  };
}

function rollbackTimelineArtifactRef(timeline: ReleaseRollbackTimelineExport): ReleaseHandoffArtifactRef {
  const checksum = stableRollbackTimelineChecksum(timeline);
  return {
    kind: 'rollback_timeline',
    artifactId: timeline.rollback.id,
    version: timeline.version,
    checksum,
    signature: signHandoffArtifact('rollback_timeline', checksum, timeline.rollback.rollbackSignature),
    sourceId: timeline.rollback.id,
    required: true,
    generatedAt: timeline.exportedAt,
    status: timeline.rollback.status,
  };
}

async function findPromotionForManifest(
  decisionId: string,
  promotionId?: string,
): Promise<ReleasePromotionRecord | null> {
  if (promotionId) return getStorageRepository().releasePromotions.getById(promotionId);
  return (await getReleasePromotionHistory(undefined, 1, { decisionId }))[0] ?? null;
}

async function findRollbackForManifest(
  decisionId: string,
  promotionId?: string,
  rollbackId?: string,
): Promise<ReleaseRollbackRecord | null> {
  if (rollbackId) return getStorageRepository().releaseRollbacks.getById(rollbackId);
  const filters = promotionId ? { promotionId } : { decisionId };
  return (await getReleaseRollbackHistory(undefined, 1, filters))[0] ?? null;
}

export async function createReleaseEvidenceBundleManifest(options: {
  decisionId?: string;
  stream?: string;
  provider?: string;
  promotionId?: string;
  rollbackId?: string;
  limit?: number;
} = {}): Promise<ReleaseEvidenceBundleManifest> {
  const bundle = await createReleaseBundleSummary({
    decisionId: options.decisionId,
    stream: options.stream,
    provider: options.provider,
    limit: options.limit ?? 8,
  });
  const artifacts: ReleaseHandoffArtifactRef[] = [
    releaseEvidenceArtifactRef(bundle.evidence),
    releaseBundleArtifactRef(bundle),
  ];
  const missingArtifacts: ReleaseHandoffArtifactKind[] = [];

  const promotion = await findPromotionForManifest(bundle.decision.id, options.promotionId);
  let promotionTimeline: ReleasePromotionTimelineExport | null = null;
  if (promotion) {
    promotionTimeline = await exportReleasePromotionTimeline(promotion.id);
    artifacts.push(promotionTimelineArtifactRef(promotionTimeline));
  } else {
    missingArtifacts.push('promotion_timeline');
  }

  const rollback = await findRollbackForManifest(bundle.decision.id, promotion?.id, options.rollbackId);
  if (rollback) {
    const rollbackTimeline = await exportReleaseRollbackTimeline(rollback.id);
    artifacts.push(rollbackTimelineArtifactRef(rollbackTimeline));
  } else {
    missingArtifacts.push('rollback_timeline');
  }

  const generatedAt = Date.now();
  const triage = {
    status: missingArtifacts.length ? 'degraded' as const : 'ready' as const,
    summary: missingArtifacts.length
      ? `Manifest is missing ${missingArtifacts.join(', ')} handoff artifacts.`
      : 'Manifest covers release evidence, bundle summary, promotion timeline, and rollback timeline artifacts.',
    recommendations: missingArtifacts.length
      ? missingArtifacts.map(kind => `Export and attach ${kind.replace(/_/g, ' ')} before publishing the handoff bundle.`)
      : ['Publish the manifest with the verified handoff artifacts.'],
  };
  const unsigned = {
    version: 'agros-release-evidence-manifest-v1' as const,
    generatedAt,
    stream: bundle.stream,
    provider: bundle.provider,
    decisionId: bundle.decision.id,
    evidenceId: bundle.evidence.id,
    promotionId: promotion?.id,
    rollbackId: rollback?.id,
    artifacts,
    missingArtifacts,
    triage,
  };
  const manifestChecksum = hashString(stableStringify(manifestChecksumPayload(unsigned)));

  return {
    ...unsigned,
    manifestChecksum,
    manifestSignature: signManifest(manifestChecksum, bundle.decision.id),
  };
}

function asObjectRecord(input: unknown): Record<string, unknown> | null {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : null;
}

function checksumFromUploadedArtifact(
  kind: ReleaseHandoffArtifactKind,
  artifact: unknown,
): string | undefined {
  const record = asObjectRecord(artifact);
  if (!record) return undefined;
  if (kind === 'release_evidence' && typeof record.id === 'string' && typeof record.stream === 'string') {
    return signReleaseEvidence(record as unknown as ReleaseEvidenceRecord).evidenceChecksum;
  }
  if (
    kind === 'release_bundle_summary'
    && asObjectRecord(record.decision)
    && asObjectRecord(record.drift)
    && asObjectRecord(record.evidence)
    && asObjectRecord(record.summary)
  ) {
    return stableReleaseBundleChecksum(record as unknown as ReleaseBundleSummary);
  }
  if (kind === 'promotion_timeline' && asObjectRecord(record.promotion) && Array.isArray(record.timeline)) {
    return stablePromotionTimelineChecksum(record as unknown as ReleasePromotionTimelineExport);
  }
  if (kind === 'rollback_timeline' && asObjectRecord(record.rollback) && Array.isArray(record.timeline)) {
    return stableRollbackTimelineChecksum(record as unknown as ReleaseRollbackTimelineExport);
  }
  if (typeof record.exportChecksum === 'string') return record.exportChecksum;
  if (typeof record.bundleChecksum === 'string') return record.bundleChecksum;
  if (typeof record.evidenceChecksum === 'string') return record.evidenceChecksum;
  if (record.bundle && typeof (record.bundle as Record<string, unknown>).bundleChecksum === 'string') {
    return (record.bundle as Record<string, unknown>).bundleChecksum as string;
  }
  if (record.timeline && typeof (record.timeline as Record<string, unknown>).exportChecksum === 'string') {
    return (record.timeline as Record<string, unknown>).exportChecksum as string;
  }
  return hashString(stableStringify(record));
}

export function verifyReleaseHandoffArtifacts(
  input: ReleaseArtifactVerificationInput,
): ReleaseArtifactVerificationReport {
  const { manifest } = input;
  const computedManifestChecksum = hashString(stableStringify(manifestChecksumPayload({
    version: manifest.version,
    generatedAt: manifest.generatedAt,
    stream: manifest.stream,
    provider: manifest.provider,
    decisionId: manifest.decisionId,
    evidenceId: manifest.evidenceId,
    promotionId: manifest.promotionId,
    rollbackId: manifest.rollbackId,
    artifacts: manifest.artifacts,
    missingArtifacts: manifest.missingArtifacts,
    triage: manifest.triage,
  })));
  const signatureMatched = computedManifestChecksum === manifest.manifestChecksum
    && manifest.manifestSignature === signManifest(manifest.manifestChecksum, manifest.decisionId);
  const mismatches: string[] = [];
  if (computedManifestChecksum !== manifest.manifestChecksum) {
    mismatches.push('Manifest checksum does not match manifest contents.');
  }
  if (!signatureMatched) {
    mismatches.push('Manifest signature does not match the manifest checksum.');
  }

  const artifacts = manifest.artifacts.map(ref => {
    const uploaded = input.artifacts?.[ref.kind];
    const actualChecksum = checksumFromUploadedArtifact(ref.kind, uploaded);
    const matched = actualChecksum === ref.checksum;
    const detail = matched
      ? `${ref.kind} checksum matched.`
      : actualChecksum
        ? `${ref.kind} checksum mismatch.`
        : `${ref.kind} artifact was not uploaded for verification.`;
    if (!matched) mismatches.push(detail);
    return {
      kind: ref.kind,
      artifactId: ref.artifactId,
      expectedChecksum: ref.checksum,
      actualChecksum,
      matched,
      detail,
    };
  });
  const missingRequired = artifacts.filter(artifact => !artifact.matched).length;
  const status = missingRequired || !signatureMatched
    ? 'blocked'
    : manifest.missingArtifacts.length
      ? 'degraded'
      : 'ready';

  return {
    version: 'agros-release-artifact-verification-v1',
    verifiedAt: Date.now(),
    status,
    manifestChecksum: manifest.manifestChecksum,
    computedManifestChecksum,
    manifestSignature: manifest.manifestSignature,
    signatureMatched,
    artifacts,
    mismatches,
    recommendations: mismatches.length
      ? ['Regenerate mismatched artifacts from the release API and rerun artifact verification before publishing.']
      : manifest.triage.recommendations,
  };
}

function normalizeIncidentPacketVisibility(
  visibility?: ReleaseIncidentPacketVisibility,
): ReleaseIncidentPacketVisibility {
  return visibility === 'public' ? 'public' : 'private';
}

function normalizeIncidentOwner(owner?: string): string {
  const trimmed = owner?.trim();
  return trimmed || 'incident-owner';
}

function redactReleaseIncidentBundle(
  bundle: ReleaseBundleSummary,
  visibility: ReleaseIncidentPacketVisibility,
): {
  bundleSummary: ReleaseBundleSummary | Record<string, unknown>;
  redactions: ReleaseIncidentPacketRedaction[];
} {
  if (visibility === 'private') {
    return { bundleSummary: bundle, redactions: [] };
  }

  const redactions: ReleaseIncidentPacketRedaction[] = [];
  const reconciliation = bundle.reconciliation
    ? {
      id: bundle.reconciliation.id,
      decisionId: bundle.reconciliation.decisionId,
      evidenceId: bundle.reconciliation.evidenceId,
      stream: bundle.reconciliation.stream,
      provider: bundle.reconciliation.provider,
      commitSha: bundle.reconciliation.commitSha,
      branch: bundle.reconciliation.branch,
      decisionSignature: bundle.reconciliation.decisionSignature,
      evidenceChecksum: bundle.reconciliation.evidenceChecksum,
      providerSignature: bundle.reconciliation.providerSignature,
      reconciliationSignature: bundle.reconciliation.reconciliationSignature,
      createdAt: bundle.reconciliation.createdAt,
    }
    : undefined;

  if (bundle.reconciliation?.pullRequestUrl) {
    redactions.push({ path: 'bundleSummary.reconciliation.pullRequestUrl', reason: 'public handoff omits private review links' });
  }
  if (bundle.reconciliation?.sourceThread) {
    redactions.push({ path: 'bundleSummary.reconciliation.sourceThread', reason: 'public handoff omits Slack thread links' });
  }
  if (bundle.reconciliation?.initiatedBy) {
    redactions.push({ path: 'bundleSummary.reconciliation.initiatedBy', reason: 'public handoff omits internal actor attribution' });
  }

  return {
    bundleSummary: {
      version: bundle.version,
      generatedAt: bundle.generatedAt,
      stream: bundle.stream,
      provider: bundle.provider,
      decision: {
        id: bundle.decision.id,
        evidenceId: bundle.decision.evidenceId,
        stream: bundle.decision.stream,
        provider: bundle.decision.provider,
        decision: bundle.decision.decision,
        decidedAt: bundle.decision.decidedAt,
        evidenceChecksum: bundle.decision.evidenceChecksum,
        providerSignature: bundle.decision.providerSignature,
        decisionSignature: bundle.decision.decisionSignature,
        createdAt: bundle.decision.createdAt,
      },
      evidence: {
        id: bundle.evidence.id,
        stream: bundle.evidence.stream,
        provider: bundle.evidence.provider,
        status: bundle.evidence.status,
        checkedAt: bundle.evidence.checkedAt,
        gateCount: bundle.evidence.gateCount,
        blockedGateCount: bundle.evidence.blockedGateCount,
        degradedGateCount: bundle.evidence.degradedGateCount,
        latestMonitorSnapshotId: bundle.evidence.latestMonitorSnapshotId,
        latestAlertSnapshotId: bundle.evidence.latestAlertSnapshotId,
        rollbackStatus: bundle.evidence.rollbackStatus,
        latestDegradedExportChecksum: bundle.evidence.latestDegradedExportChecksum,
        createdAt: bundle.evidence.createdAt,
      },
      reconciliation,
      comparison: bundle.comparison,
      drift: bundle.drift,
      history: bundle.history.map(item => ({
        id: item.id,
        stream: item.stream,
        provider: item.provider,
        status: item.status,
        checkedAt: item.checkedAt,
        rollbackStatus: item.rollbackStatus,
        createdAt: item.createdAt,
      })),
      summary: bundle.summary,
      bundleChecksum: bundle.bundleChecksum,
    },
    redactions,
  };
}

function releaseIncidentPacketStatus(input: {
  verification: ReleaseArtifactVerificationReport;
  drift: ReleaseDriftReport;
  rollbackTimeline?: ReleaseRollbackTimelineExport;
  manifest: ReleaseEvidenceBundleManifest;
}): ReleaseIncidentPacketExport['summary'] {
  const rollbackStatus = input.rollbackTimeline?.rollback.status ?? 'missing';
  const status: ReleaseGateStatus = input.verification.status === 'blocked'
    ? 'blocked'
    : input.drift.status === 'degraded' || input.verification.status === 'degraded' || input.manifest.missingArtifacts.length
      ? 'degraded'
      : 'ready';
  const recommendation = status === 'ready'
    ? 'Publish the incident packet with the verified release handoff artifacts.'
    : status === 'blocked'
      ? 'Do not publish the incident packet until artifact verification mismatches are resolved.'
      : 'Publish only with operator acknowledgement of missing timelines or post-release drift.';

  return {
    status,
    recommendation,
    artifactStatus: input.verification.status,
    driftStatus: input.drift.status,
    rollbackStatus,
  };
}

export async function createReleaseIncidentPacket(
  options: ReleaseIncidentPacketInput = {},
): Promise<ReleaseIncidentPacketExport> {
  const owner = normalizeIncidentOwner(options.owner);
  const visibility = normalizeIncidentPacketVisibility(options.visibility);
  const manifest = await createReleaseEvidenceBundleManifest({
    decisionId: options.decisionId,
    stream: options.stream,
    provider: options.provider,
    promotionId: options.promotionId,
    rollbackId: options.rollbackId,
    limit: options.limit ?? 8,
  });
  const bundle = await createReleaseBundleSummary({
    decisionId: manifest.decisionId,
    stream: manifest.stream,
    provider: manifest.provider,
    limit: options.limit ?? 8,
  });
  const promotionTimeline = manifest.promotionId
    ? await exportReleasePromotionTimeline(manifest.promotionId)
    : undefined;
  const rollbackTimeline = manifest.rollbackId
    ? await exportReleaseRollbackTimeline(manifest.rollbackId)
    : undefined;
  const drift = await collectPostReleaseDrift(manifest.decisionId, { persistMonitor: false });
  const verification = options.verification ?? verifyReleaseHandoffArtifacts({
    manifest,
    artifacts: {
      release_evidence: bundle.evidence,
      release_bundle_summary: bundle,
      promotion_timeline: promotionTimeline ?? rollbackTimeline?.promotionTimeline,
      rollback_timeline: rollbackTimeline,
    },
  });
  const { bundleSummary, redactions } = redactReleaseIncidentBundle(bundle, visibility);
  const summary = releaseIncidentPacketStatus({
    verification,
    drift,
    rollbackTimeline,
    manifest,
  });
  const generatedAt = Date.now();
  const packetChecksum = hashString(stableStringify({
    decisionId: manifest.decisionId,
    driftChecksum: drift.driftChecksum,
    generatedAt,
    manifestChecksum: manifest.manifestChecksum,
    owner,
    packetVisibility: visibility,
    promotionChecksum: promotionTimeline?.exportChecksum ?? null,
    redactions: redactions.map(redaction => redaction.path),
    rollbackChecksum: rollbackTimeline?.exportChecksum ?? null,
    status: summary.status,
    verificationStatus: verification.status,
  }));

  return {
    version: 'agros-release-incident-packet-v1',
    generatedAt,
    visibility,
    owner,
    stream: manifest.stream,
    provider: manifest.provider,
    decisionId: manifest.decisionId,
    evidenceId: manifest.evidenceId,
    promotionId: manifest.promotionId,
    rollbackId: manifest.rollbackId,
    manifest,
    verification,
    drift,
    bundleSummary,
    promotionTimeline,
    rollbackTimeline,
    redactions,
    summary,
    packetChecksum,
  };
}
