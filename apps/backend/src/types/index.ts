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
