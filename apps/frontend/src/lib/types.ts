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
