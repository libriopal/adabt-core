// Core types shared across the backend

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
  differentialCurve?: 'linear' | 'exponential' | 'parabola' | 'sigmoid';
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

export interface ReleaseEvidenceRecord {
  id: string;
  stream: string;
  provider: string;
  status: 'ready' | 'degraded' | 'blocked';
  checkedAt: number;
  gateCount: number;
  blockedGateCount: number;
  degradedGateCount: number;
  latestMonitorSnapshotId?: string;
  latestAlertSnapshotId?: string;
  rollbackStatus: 'ready' | 'degraded' | 'blocked';
  latestDegradedExportChecksum?: string;
  report: Record<string, unknown>;
  createdAt: number;
}

export interface ReleaseDecisionRecord {
  id: string;
  evidenceId: string;
  stream: string;
  provider: string;
  decision: 'go' | 'no-go' | 'exception';
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

export interface ReleaseDriftOverrideRecord {
  id: string;
  decisionId: string;
  evidenceId: string;
  stream: string;
  provider: string;
  environment: 'local' | 'staging' | 'production';
  driftChecksum: string;
  decisionSignature: string;
  reason: string;
  overriddenBy: string;
  overrideSignature: string;
  createdAt: number;
}

export type ReleasePromotionStatus = 'started' | 'stopped' | 'approved' | 'rejected' | 'deployed' | 'failed';

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
  environment: 'local' | 'staging' | 'production';
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

export interface Design {
  id: string;
  seed: string;
  timestamp: number;
  input: string;
  mode: 'FAST' | 'FULL';
  intentVector: IntentVector;
  mechanics: SlotMechanics;
  content: {
    type: string;
    content: string;
    entropy: number;
    poetryTechnique: string;
  };
  score: {
    total: number;
    demand: number;
    engagement: number;
    novelty: number;
    retention: number;
  };
  generation: number;
  parentIds?: string[];
}

export interface GenerationSnapshot {
  generation: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  diversity: number;
  timestamp: number;
}

export interface EvolutionConfig {
  populationSize: number;
  maxGenerations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteRatio: number;
  selectionPressure?: number;
  parallelBatches: number;
}

export interface EvolutionState {
  runId: string;
  currentGeneration: number;
  maxGenerations: number;
  populationSize: number;
  mutationRate: number;
  eliteRatio: number;
  designs: Design[];
  history: GenerationSnapshot[];
  status: 'running' | 'paused' | 'completed' | 'error';
  config: EvolutionConfig;
}

export interface BatchConfig {
  count: number;
  mode: 'FAST' | 'FULL' | 'HYBRID';
  inputBase: string;
  mutationIntensity?: number;
  differentialCurve?: SlotMechanics['differentialCurve'];
}

export interface EvolutionBatchJob {
  runId: string;
  designs: Design[];
  generation: number;
  config: EvolutionConfig;
}

export interface GenerateBatchRequest {
  input: string;
  count?: number;
  mode?: 'FAST' | 'FULL' | 'HYBRID';
  differentialCurve?: 'linear' | 'exponential' | 'parabola' | 'sigmoid';
}

export interface EvolveRequest {
  seedDesigns?: Design[];
  maxGenerations?: number;
  populationSize?: number;
  mutationRate?: number;
  resumeRunId?: string;
}

export interface ImportRequest {
  designs: Design[];
  preserveIds?: boolean;
}

export interface DBDesign extends Design {
  exported: boolean;
  archived: boolean;
}

export interface DBEvolutionRun extends EvolutionState {
  createdAt: number;
  updatedAt: number;
}
