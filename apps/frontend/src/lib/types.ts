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
