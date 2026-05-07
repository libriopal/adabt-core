import { DeterministicPRNG } from '../utils/prng';
import {
  EpochSnapshot,
  EvolutionRunSnapshot,
  EvolutionSimulatorConfig,
  EvolutionVariant,
} from './types';
import {
  createSeedPopulation,
  crossoverVariants,
  mutateVariant,
} from './mutation';
import {
  applyScores,
  createEpochSnapshot,
  scorePopulation,
  selectParents,
} from './selection';

export const DEFAULT_EVOLUTION_CONFIG: EvolutionSimulatorConfig = {
  seed: 'agros-phase-3',
  populationSize: 16,
  epochs: 8,
  mutationRate: 0.18,
  eliteRatio: 0.18,
  selectionPressure: 0.55,
};

export function runEvolutionSimulation(
  config: Partial<EvolutionSimulatorConfig> = {},
): EvolutionRunSnapshot {
  const resolved = { ...DEFAULT_EVOLUTION_CONFIG, ...config };
  const epochs: EpochSnapshot[] = [];
  let population = createSeedPopulation(resolved.seed, resolved.populationSize);

  for (let epoch = 0; epoch <= resolved.epochs; epoch++) {
    const scored = applyScores(population, scorePopulation(population));
    const snapshot = createEpochSnapshot(
      epoch,
      resolved.seed,
      scored,
      scorePopulation(scored),
      resolved.selectionPressure,
    );

    epochs.push(snapshot);
    population = scored;

    if (epoch === resolved.epochs) break;
    population = createNextPopulation(population, resolved, epoch + 1);
  }

  const finalEpoch = epochs[epochs.length - 1];
  const bestVariant = [...finalEpoch.population].sort((a, b) => b.fitness - a.fitness)[0];

  return {
    config: resolved,
    epochs,
    finalPopulation: finalEpoch.population,
    checkpoint: {
      phase: 'PHASE_3',
      status: 'validated',
      deterministicChecksum: finalEpoch.checksum,
      finalEpoch: finalEpoch.epoch,
      bestVariantId: bestVariant.id,
    },
  };
}

export function verifyDeterministicParity(config: Partial<EvolutionSimulatorConfig> = {}): boolean {
  const first = runEvolutionSimulation(config);
  const second = runEvolutionSimulation(config);
  return first.checkpoint.deterministicChecksum === second.checkpoint.deterministicChecksum;
}

function createNextPopulation(
  population: EvolutionVariant[],
  config: EvolutionSimulatorConfig,
  epoch: number,
): EvolutionVariant[] {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  const eliteCount = Math.max(1, Math.floor(config.populationSize * config.eliteRatio));
  const elites = sorted.slice(0, eliteCount).map(variant => ({
    ...variant,
    epoch,
    lineage: [...new Set([...variant.lineage, variant.id])],
    parentIds: [variant.id],
  }));

  const prng = new DeterministicPRNG(`${config.seed}:epoch:${epoch}:next`);
  const parents = selectParents(population, config.seed, epoch, config.selectionPressure);
  const nextPopulation = [...elites];

  while (nextPopulation.length < config.populationSize) {
    const parentA = prng.pick(parents);
    const parentB = prng.pick(parents);
    const child = crossoverVariants(parentA, parentB, config.seed, epoch, nextPopulation.length);
    nextPopulation.push(mutateVariant(child, config.seed, epoch, config.mutationRate));
  }

  return nextPopulation.slice(0, config.populationSize);
}
