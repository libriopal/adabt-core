import { DeterministicPRNG } from '../utils/prng';
import { EpochSnapshot, EvolutionVariant, ScoringMatrix } from './types';

const SCORE_WEIGHTS = {
  continuity: 0.28,
  novelty: 0.24,
  volatilityFit: 0.18,
  compressionPotential: 0.20,
  diversityBonus: 0.10,
};

export function scorePopulation(population: EvolutionVariant[]): Record<string, ScoringMatrix> {
  return population.reduce<Record<string, ScoringMatrix>>((scores, variant) => {
    const continuity = scoreContinuity(variant);
    const novelty = scoreNovelty(variant);
    const volatilityFit = 1 - Math.abs(variant.genome.volatility - variant.genome.retentionPull);
    const compressionPotential = (variant.genome.compressionAffinity + variant.genome.symbolDensity) / 2;
    const diversityBonus = calculateVariantDiversity(variant, population);
    const fitness =
      continuity * SCORE_WEIGHTS.continuity +
      novelty * SCORE_WEIGHTS.novelty +
      volatilityFit * SCORE_WEIGHTS.volatilityFit +
      compressionPotential * SCORE_WEIGHTS.compressionPotential +
      diversityBonus * SCORE_WEIGHTS.diversityBonus;

    scores[variant.id] = {
      continuity: roundScore(continuity),
      novelty: roundScore(novelty),
      volatilityFit: roundScore(volatilityFit),
      compressionPotential: roundScore(compressionPotential),
      fitness: roundScore(fitness),
    };
    return scores;
  }, {});
}

export function applyScores(
  population: EvolutionVariant[],
  scoreMatrix: Record<string, ScoringMatrix>,
): EvolutionVariant[] {
  return population.map(variant => ({
    ...variant,
    fitness: scoreMatrix[variant.id]?.fitness ?? 0,
  }));
}

export function selectParents(
  population: EvolutionVariant[],
  seed: string,
  epoch: number,
  selectionPressure: number,
): EvolutionVariant[] {
  const prng = new DeterministicPRNG(`${seed}:selection:${epoch}`);
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  const tournamentSize = Math.max(2, Math.min(sorted.length, Math.round(2 + selectionPressure * 4)));

  return population.map(() => {
    const tournament = prng.shuffle(sorted).slice(0, tournamentSize);
    return tournament.sort((a, b) => b.fitness - a.fitness)[0];
  });
}

export function createEpochSnapshot(
  epoch: number,
  seed: string,
  population: EvolutionVariant[],
  scoreMatrix: Record<string, ScoringMatrix>,
  selectionPressure: number,
): EpochSnapshot {
  const fitnessValues = population.map(variant => variant.fitness);
  const lineageEdges = population.flatMap(variant =>
    variant.parentIds.map(source => ({ source, target: variant.id }))
  );

  return {
    epoch,
    seed: `${seed}:epoch:${epoch}`,
    population,
    scoreMatrix,
    averageFitness: roundScore(fitnessValues.reduce((sum, value) => sum + value, 0) / fitnessValues.length),
    bestFitness: roundScore(Math.max(...fitnessValues)),
    diversity: roundScore(calculatePopulationDiversity(population)),
    selectionPressure,
    mutationCount: population.reduce((sum, variant) => (
      sum + variant.mutationHistory.filter(mutation => mutation.epoch === epoch && mutation.reason === 'point').length
    ), 0),
    lineageEdges,
    checksum: checksumPopulation(population, scoreMatrix),
  };
}

function scoreContinuity(variant: EvolutionVariant): number {
  const inherited = Math.min(variant.lineage.length / 8, 1);
  const retention = variant.genome.retentionPull;
  return inherited * 0.35 + retention * 0.65;
}

function scoreNovelty(variant: EvolutionVariant): number {
  const activation =
    variant.genome.aestheticIntensity * 0.35 +
    variant.genome.bonusComplexity * 0.35 +
    variant.genome.symbolDensity * 0.30;
  return clamp(activation, 0, 1);
}

function calculateVariantDiversity(variant: EvolutionVariant, population: EvolutionVariant[]): number {
  if (population.length <= 1) return 1;

  const total = population.reduce((sum, other) => {
    if (other.id === variant.id) return sum;
    return sum + genomeDistance(variant, other);
  }, 0);

  return total / (population.length - 1);
}

function calculatePopulationDiversity(population: EvolutionVariant[]): number {
  if (population.length <= 1) return 1;

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      total += genomeDistance(population[i], population[j]);
      pairs++;
    }
  }

  return pairs > 0 ? total / pairs : 1;
}

function genomeDistance(a: EvolutionVariant, b: EvolutionVariant): number {
  const genes = Object.keys(a.genome);
  const distance = genes.reduce((sum, gene) => (
    sum + Math.abs((a.genome[gene] ?? 0) - (b.genome[gene] ?? 0))
  ), 0);
  return distance / genes.length;
}

function checksumPopulation(
  population: EvolutionVariant[],
  scoreMatrix: Record<string, ScoringMatrix>,
): string {
  const content = JSON.stringify(population.map(variant => ({
    id: variant.id,
    genome: variant.genome,
    fitness: scoreMatrix[variant.id]?.fitness,
    lineage: variant.lineage,
  })));

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function roundScore(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(4));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
