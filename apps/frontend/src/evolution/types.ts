export type Genome = Record<string, number>;

export interface EvolutionVariant {
  id: string;
  genome: Genome;
  fitness: number;
  lineage: string[];
  epoch: number;
  parentIds: string[];
  mutationHistory: MutationEvent[];
}

export interface MutationEvent {
  id: string;
  epoch: number;
  variantId: string;
  gene: string;
  oldValue: number;
  newValue: number;
  magnitude: number;
  reason: 'seed' | 'point' | 'crossover' | 'selection';
}

export interface ScoringMatrix {
  continuity: number;
  novelty: number;
  volatilityFit: number;
  compressionPotential: number;
  fitness: number;
}

export interface EpochSnapshot {
  epoch: number;
  seed: string;
  population: EvolutionVariant[];
  scoreMatrix: Record<string, ScoringMatrix>;
  averageFitness: number;
  bestFitness: number;
  diversity: number;
  selectionPressure: number;
  mutationCount: number;
  lineageEdges: Array<{ source: string; target: string }>;
  checksum: string;
}

export interface EvolutionSimulatorConfig {
  seed: string;
  populationSize: number;
  epochs: number;
  mutationRate: number;
  eliteRatio: number;
  selectionPressure: number;
}

export interface EvolutionRunSnapshot {
  config: EvolutionSimulatorConfig;
  epochs: EpochSnapshot[];
  finalPopulation: EvolutionVariant[];
  checkpoint: {
    phase: 'PHASE_3';
    status: 'validated';
    deterministicChecksum: string;
    finalEpoch: number;
    bestVariantId: string;
  };
}
