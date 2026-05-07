// Frontend type definitions — superset of backend types

export interface IntentVector {
  conflictIntensity: number;
  volatilitySignal: number;
  symbolicDensity: number;
  aestheticIntensity: number;
  thematicCluster: string;
  contentComplexity: number;
  renderingMode: 'direct' | 'symbolic' | 'encoded';
}

export interface SlotMechanics {
  volatilityClass: 'low' | 'medium' | 'high' | 'extreme';
  bonusLogic: string;
  featureTriggers: string[];
  payoutBehavior: string;
  poeticStrategy: 'literal' | 'symbolic' | 'encodedVerse' | 'abstract';
}

export interface NarrativeInput {
  input: string;
  timestamp: number;
}

export interface RenderedContent {
  type: 'literal' | 'symbolic' | 'encodedVerse' | 'abstract' | 'conceit';
  content: string;
  entropy: number;
  poetryTechnique: string;
  verseKey?: string;
  fibonacciFragments?: string[];
}

export interface Plugin {
  id: string;
  name: string;
  type: 'aesthetic' | 'mechanic' | 'content';
  apply: (input: any) => any;
  bypass?: boolean;
}

export interface Explainability {
  reasoning: string;
  dominantIntent: string;
  weightSnapshot: {
    volatilityWeight: number;
    bonusWeight: number;
    featureWeight: number;
    poeticWeight: number;
  };
  renderingPath: string;
  poetryTechnique?: string;
  bypassTechnique?: string;
}

export interface Cache {
  themeCache: Map<string, any>;
  intentVectorCache: Map<string, IntentVector>;
  mechanicCache: Map<string, SlotMechanics>;
  contentCache: Map<string, RenderedContent>;
  bypassCache: Map<string, any>;
  demandCache: Map<string, DemandResult>;
}

export interface RawReview {
  text: string;
  timestamp: number;
  source: string;
  rating?: number;
}

export interface DemandSignal {
  source?: string;
  sentiment: number;
  intensity: number;
  keywords: string[];
  trendWeight: number;
  popularity?: number;
  confidence?: number;
}

export interface DemandResult {
  demandScore: number;
  trendVector: number[];
  keywordClusters: string[];
  timestamp: number;
  volume?: number;
  keywordVector?: Record<string, number>;
  signals?: DemandSignal[];
  sourceBreakdown?: DemandSourceBreakdown[];
  sourceWeights?: Record<string, number>;
  reinforcementInputs?: {
    demandWeight: number;
    trendMomentum: number;
    sentimentBias: number;
    popularityPressure: number;
  };
  checksum?: string;
}

export interface DemandSourceBreakdown {
  source: string;
  signalCount: number;
  sentiment: number;
  intensity: number;
  trendWeight: number;
  popularity: number;
  confidence: number;
  keywords: string[];
}

export interface ReinforcementAxes {
  demand: number;
  engagement: number;
  novelty: number;
  retention: number;
  diversity: number;
  stability: number;
}

export interface ReinforcementWeights extends ReinforcementAxes {}

export interface ReinforcementGateReport {
  status: 'pass' | 'warn' | 'blocked';
  reasons: string[];
  stabilityBoundary: number;
  confidenceBoundary: number;
  mutationBoundary: number;
}

export interface ReinforcementLineageEntry {
  designId: string;
  parentIds: string[];
  generation: number;
  inheritedScore: number;
  rewardChecksum: string;
}

export interface ReinforcementDecision {
  id: string;
  designId: string;
  total: number;
  axes: ReinforcementAxes;
  weights: ReinforcementWeights;
  gate: ReinforcementGateReport;
  mutationWeight: number;
  lineage: ReinforcementLineageEntry;
  demandChecksum: string;
  replayChecksum: string;
}

export interface ReinforcementReplaySummary {
  stable: boolean;
  checksum: string;
  firstChecksum: string;
  secondChecksum: string;
  decisionCount: number;
  gateStatuses: Record<string, number>;
}

export interface EventLogEntry {
  id: string;
  stream: string;
  type: string;
  sequence: number;
  payload: Record<string, unknown>;
  replayChecksum: string;
  createdAt: number;
}

export interface ReplayCheckpoint {
  id: string;
  stream: string;
  label: string;
  eventCount: number;
  replayChecksum: string;
  state: Record<string, unknown>;
  createdAt: number;
}

export interface ReplayHistoryVerification {
  stable: boolean;
  stream: string;
  eventCount: number;
  checkpointCount: number;
  latestChecksum: string;
  latestCheckpointId?: string;
  failures: string[];
}

export interface ReplayHistoryResult {
  stream: string;
  events: EventLogEntry[];
  checkpoints: ReplayCheckpoint[];
  verification: ReplayHistoryVerification;
}

export interface ReplayCheckpointDiff {
  stream: string;
  base: ReplayCheckpoint;
  target: ReplayCheckpoint;
  eventDelta: number;
  checksumChanged: boolean;
  stateStable: boolean;
  checkDeltas: Array<{
    name: string;
    baseStable?: boolean;
    targetStable?: boolean;
    baseChecksum?: string | null;
    targetChecksum?: string | null;
    changed: boolean;
  }>;
  degradedChecks: string[];
}

export interface ReplayHistoryMonitorReport {
  status: 'ready' | 'degraded';
  stream: string;
  checkedAt: number;
  snapshotId?: string;
  verification: ReplayHistoryVerification;
  latestCheckpoint?: ReplayCheckpoint;
  previousCheckpoint?: ReplayCheckpoint;
  latestDiff?: ReplayCheckpointDiff;
  alerts: string[];
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

export interface ReplayMonitorSnapshot {
  id: string;
  stream: string;
  status: 'ready' | 'degraded';
  checkedAt: number;
  eventCount: number;
  checkpointCount: number;
  latestCheckpointId?: string;
  alertCount: number;
  alerts: string[];
  report: Record<string, unknown>;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

export interface ContinuityEvent {
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface ContinuityExportBundle {
  version: 'agros-continuity-export-v1';
  exportedAt: number;
  stream: string;
  anchor: ReplayCheckpoint | null;
  replay: ReplayHistoryResult;
  continuity: {
    interruptedRuns: string[];
    connectedClients: number;
    events: ContinuityEvent[];
  };
  verification: ReplayHistoryVerification;
  exportChecksum: string;
}

export interface DegradedReplayExportBundle {
  version: 'agros-degraded-replay-export-v1';
  exportedAt: number;
  stream: string;
  monitor: ReplayHistoryMonitorReport;
  monitorSnapshot: ReplayMonitorSnapshot | null;
  continuityExport: ContinuityExportBundle;
  recommendations: string[];
  exportChecksum: string;
}

export type ReleaseGateStatus = 'ready' | 'degraded' | 'blocked';

export interface ReleaseGateReport {
  name: string;
  status: ReleaseGateStatus;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface ReleaseReadinessReport {
  status: ReleaseGateStatus;
  checkedAt: number;
  stream: string;
  provider: string;
  runtime: {
    status: 'ready' | 'degraded';
    environment: string;
    warnings: string[];
    config: Record<string, unknown>;
  };
  replayMonitor: ReplayHistoryMonitorReport;
  latestMonitorSnapshot?: ReplayMonitorSnapshot;
  latestAlertSnapshot?: ReplayMonitorSnapshot;
  latestAcknowledgedAlertSnapshot?: ReplayMonitorSnapshot;
  gates: ReleaseGateReport[];
  rollbackPreflight: {
    status: ReleaseGateStatus;
    detail: string;
    degradedExportChecksum?: string;
    monitorSnapshotId?: string;
    recommendations: string[];
  };
  recommendations: string[];
}

export interface ReleaseEvidenceRecord {
  id: string;
  stream: string;
  provider: string;
  status: ReleaseGateStatus;
  checkedAt: number;
  gateCount: number;
  blockedGateCount: number;
  degradedGateCount: number;
  latestMonitorSnapshotId?: string;
  latestAlertSnapshotId?: string;
  rollbackStatus: ReleaseGateStatus;
  latestDegradedExportChecksum?: string;
  report: Record<string, unknown>;
  createdAt: number;
}

export interface ReleaseEvidenceExportBundle {
  version: 'agros-release-evidence-v1';
  id: string;
  exportedAt: number;
  stream: string;
  provider: string;
  release: ReleaseReadinessReport;
  evidenceRecord: ReleaseEvidenceRecord;
  history: ReleaseEvidenceRecord[];
  degradedReplayExport: DegradedReplayExportBundle | null;
  exportChecksum: string;
}

export type ReleaseDecisionOutcome = 'go' | 'no-go' | 'exception';

export interface ReleaseDecisionRecord {
  id: string;
  evidenceId: string;
  stream: string;
  provider: string;
  decision: ReleaseDecisionOutcome;
  reason: string;
  decidedBy: string;
  decidedAt: number;
  evidenceChecksum: string;
  providerSignature: string;
  decisionSignature: string;
  createdAt: number;
}

export interface ReleaseReconciliationRecord {
  id: string;
  decisionId: string;
  evidenceId: string;
  stream: string;
  provider: string;
  commitSha: string;
  branch: string;
  pullRequestUrl?: string;
  sourceThread?: string;
  initiatedBy?: string;
  decisionSignature: string;
  evidenceChecksum: string;
  providerSignature: string;
  reconciliationSignature: string;
  createdAt: number;
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
    driftState: 'ready' | 'degraded';
    recommendation: string;
  };
  bundleChecksum: string;
}

export type ReleaseEnvironment = 'local' | 'staging' | 'production';

export interface ReleaseRetentionPolicyPreset {
  name: ReleaseEnvironment;
  environment: ReleaseEnvironment;
  retainLatest: number;
  dryRunDefault: boolean;
  description: string;
}

export interface ReleaseDriftOverrideRecord {
  id: string;
  decisionId: string;
  evidenceId: string;
  stream: string;
  provider: string;
  environment: ReleaseEnvironment;
  driftChecksum: string;
  decisionSignature: string;
  reason: string;
  overriddenBy: string;
  overrideSignature: string;
  createdAt: number;
}

export interface ReleaseSupervisionStatusCard {
  version: 'agros-release-supervision-card-v1';
  title: string;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'danger';
  summary: string;
  environment: ReleaseEnvironment;
  decisionId: string;
  bundle: ReleaseBundleSummary;
  retentionPolicy: ReleaseRetentionPolicyPreset;
  latestOverride?: ReleaseDriftOverrideRecord;
  sections: Array<{ title: string; body: string }>;
  facts: Array<{ label: string; value: string }>;
  links: Array<{ label: string; url: string }>;
  actions: Array<{
    type: 'prompt_run';
    actionId: string;
    label: string;
    prompt: string;
    style?: 'primary' | 'danger';
  }>;
  exampleReplies: Array<{ actionId: string; label: string; reply: string }>;
  cardChecksum: string;
}

export type ReleasePromotionStatus = 'started' | 'stopped' | 'approved' | 'rejected' | 'deployed' | 'failed';

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

export interface ReleasePromotionTimelineEntry {
  type: string;
  at: number;
  actor?: string;
  detail: string;
  checksum: string;
}

export interface ReleasePromotionCiCheck {
  name: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'skipped';
  url?: string;
  checkedAt: number;
  detail?: string;
  checksum: string;
}

export interface ReleasePromotionRecord {
  id: string;
  decisionId: string;
  evidenceId: string;
  stream: string;
  provider: string;
  environment: ReleaseEnvironment;
  status: ReleasePromotionStatus;
  startedAt: number;
  stoppedAt?: number;
  approvedAt?: number;
  approvedBy?: string;
  outcomeAt?: number;
  outcome?: 'succeeded' | 'failed' | 'cancelled';
  commandId?: string;
  commandLabel?: string;
  supervisionCardChecksum: string;
  promotionSignature: string;
  timeline: ReleasePromotionTimelineEntry[];
  ciChecks: ReleasePromotionCiCheck[];
  createdAt: number;
  updatedAt: number;
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

export type ReleaseRollbackStatus = 'planned' | 'approved' | 'rehearsed' | 'executed' | 'failed' | 'cancelled';

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

export interface ReleaseRollbackRecord {
  id: string;
  promotionId: string;
  decisionId: string;
  evidenceId: string;
  stream: string;
  provider: string;
  environment: ReleaseEnvironment;
  status: ReleaseRollbackStatus;
  plannedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  outcomeAt?: number;
  outcome?: 'succeeded' | 'failed' | 'cancelled';
  commandId?: string;
  commandLabel?: string;
  promotionTimelineChecksum: string;
  rollbackSignature: string;
  timeline: ReleasePromotionTimelineEntry[];
  ciChecks: ReleasePromotionCiCheck[];
  createdAt: number;
  updatedAt: number;
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

export interface SlotGPTOutput {
  id: string;
  transformedTheme: string;
  structuredTheme: any;
  slotgptPrompt: string;
  agents: any;
  simulation: number;
  variants: { A: any; B: any; C: any };
  explainability: Explainability;
  score: number;
  contentRendered: RenderedContent;
  poetryApplied: boolean;
  demandResult?: DemandResult;
}

export interface TransformResult {
  narrative: NarrativeInput;
  mechanics: SlotMechanics;
  content: RenderedContent;
  explainability: Explainability;
}
