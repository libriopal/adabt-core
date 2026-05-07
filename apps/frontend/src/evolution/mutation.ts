import { DeterministicPRNG } from '../utils/prng';
import { EvolutionVariant, Genome, MutationEvent } from './types';

const GENES = [
  'volatility',
  'symbolDensity',
  'aestheticIntensity',
  'bonusComplexity',
  'retentionPull',
  'compressionAffinity',
] as const;

type GeneName = typeof GENES[number];

const GENE_BOUNDS: Record<GeneName, [number, number]> = {
  volatility: [0, 1],
  symbolDensity: [0, 1],
  aestheticIntensity: [0, 1],
  bonusComplexity: [0, 1],
  retentionPull: [0, 1],
  compressionAffinity: [0, 1],
};

export function createSeedPopulation(seed: string, populationSize: number): EvolutionVariant[] {
  const prng = new DeterministicPRNG(`${seed}:population`);

  return Array.from({ length: populationSize }, (_, index) => {
    const genome = GENES.reduce<Genome>((acc, gene) => {
      acc[gene] = roundGene(prng.next());
      return acc;
    }, {});

    return {
      id: `seed_${index}_${hashId(`${seed}:${index}`)}`,
      genome,
      fitness: 0,
      lineage: [],
      epoch: 0,
      parentIds: [],
      mutationHistory: GENES.map(gene => ({
        id: `seed_${index}_${gene}`,
        epoch: 0,
        variantId: `seed_${index}_${hashId(`${seed}:${index}`)}`,
        gene,
        oldValue: 0,
        newValue: genome[gene],
        magnitude: genome[gene],
        reason: 'seed',
      })),
    };
  });
}

export function crossoverVariants(
  parentA: EvolutionVariant,
  parentB: EvolutionVariant,
  seed: string,
  epoch: number,
  index: number,
): EvolutionVariant {
  const prng = new DeterministicPRNG(`${seed}:crossover:${epoch}:${index}:${parentA.id}:${parentB.id}`);
  const alpha = prng.next();
  const genome = GENES.reduce<Genome>((acc, gene) => {
    const inherited = parentA.genome[gene] * alpha + parentB.genome[gene] * (1 - alpha);
    acc[gene] = roundGene(inherited);
    return acc;
  }, {});

  const childId = `epoch_${epoch}_${index}_${hashId(JSON.stringify({ seed, epoch, index, a: parentA.id, b: parentB.id }))}`;

  return {
    id: childId,
    genome,
    fitness: 0,
    lineage: [...new Set([...parentA.lineage, ...parentB.lineage, parentA.id, parentB.id])],
    epoch,
    parentIds: [parentA.id, parentB.id],
    mutationHistory: [{
      id: `${childId}_crossover`,
      epoch,
      variantId: childId,
      gene: 'genome',
      oldValue: parentA.fitness,
      newValue: parentB.fitness,
      magnitude: Math.abs(parentA.fitness - parentB.fitness),
      reason: 'crossover',
    }],
  };
}

export function mutateVariant(
  variant: EvolutionVariant,
  seed: string,
  epoch: number,
  mutationRate: number,
): EvolutionVariant {
  const prng = new DeterministicPRNG(`${seed}:mutation:${epoch}:${variant.id}`);
  const mutationHistory: MutationEvent[] = [...variant.mutationHistory];
  const genome = { ...variant.genome };

  for (const gene of GENES) {
    if (prng.next() > mutationRate) continue;

    const [min, max] = GENE_BOUNDS[gene];
    const oldValue = genome[gene];
    const direction = prng.next() > 0.5 ? 1 : -1;
    const magnitude = roundGene(0.03 + prng.next() * 0.17);
    const newValue = roundGene(clamp(oldValue + direction * magnitude, min, max));

    genome[gene] = newValue;
    mutationHistory.push({
      id: `${variant.id}_${gene}_${epoch}`,
      epoch,
      variantId: variant.id,
      gene,
      oldValue,
      newValue,
      magnitude: Math.abs(newValue - oldValue),
      reason: 'point',
    });
  }

  return {
    ...variant,
    genome,
    mutationHistory,
  };
}

export function getEvolutionGenes(): string[] {
  return [...GENES];
}

function roundGene(value: number): number {
  return Number(value.toFixed(4));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hashId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}
