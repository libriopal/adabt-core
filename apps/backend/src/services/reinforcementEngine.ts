import {
  DemandResult,
  Design,
  ReinforcementAxes,
  ReinforcementDecision,
  ReinforcementGateReport,
  ReinforcementLineageEntry,
  ReinforcementReplaySummary,
  ReinforcementWeights,
} from '../types';
import { getStorageRepository } from '../storage/repository';
import { demandEngine } from './demandEngine';
import { hashString } from '../utils/prng';

export interface RewardBreakdown extends ReinforcementAxes {
  total: number;
  mutationWeight: number;
  gateStatus: ReinforcementGateReport['status'];
  replayChecksum: string;
  decision: ReinforcementDecision;
}

interface EvaluationOptions {
  demand?: DemandResult;
  diversity?: number;
  persist?: boolean;
}

const BASE_WEIGHTS: ReinforcementWeights = {
  demand: 0.34,
  engagement: 0.18,
  novelty: 0.17,
  retention: 0.15,
  diversity: 0.08,
  stability: 0.08,
};

const ADAPTATION_LIMITS = {
  maxDemandShift: 0.08,
  maxEngagementShift: 0.05,
  maxRetentionShift: 0.05,
  maxStabilityShift: 0.07,
};

const STRUTHIO_GATE_BOUNDARIES = {
  minimumStability: 0.42,
  warningStability: 0.55,
  minimumConfidence: 0.48,
  warningConfidence: 0.6,
  maximumMutationWeight: 1.35,
};

export class ReinforcementEngine {
  async evaluateDesign(design: Design, options: EvaluationOptions = {}): Promise<RewardBreakdown> {
    const demand = options.demand || await this.getDemand();
    const diversity = options.diversity ?? 0.5;
    const axes = this.calculateAxes(design, demand, diversity);
    const weights = this.shapeWeights(demand);
    const baseTotal = weightedScore(axes, weights);
    const gate = this.evaluateGate(axes, demand);
    const gatedTotal = gate.status === 'blocked' ? Math.min(baseTotal, 0.39) : baseTotal;
    const mutationWeight = this.calculateMutationWeight(axes, gate);
    const lineage = this.createLineage(design, gatedTotal, demand);
    const demandChecksum = demand.checksum || hashString(JSON.stringify(demand));
    const replayChecksum = this.createReplayChecksum(design.id, axes, weights, gate, mutationWeight, demandChecksum);
    const decision: ReinforcementDecision = {
      id: `reinforce_${hashString(`${design.id}:${replayChecksum}`)}`,
      designId: design.id,
      total: round(gatedTotal),
      axes,
      weights,
      gate,
      mutationWeight,
      lineage,
      demandChecksum,
      replayChecksum,
    };

    if (options.persist !== false) {
      try {
        await getStorageRepository().reinforcement.save(decision);
      } catch {
        // Tests and replay can run before a DB is initialized.
      }
    }

    return {
      total: decision.total,
      ...axes,
      mutationWeight,
      gateStatus: gate.status,
      replayChecksum,
      decision,
    };
  }

  async evaluatePopulation(designs: Design[]): Promise<Array<RewardBreakdown & { design: Design }>> {
    const demand = await this.getDemand();
    const diversities = this.calculatePopulationDiversities(designs);

    return Promise.all(
      designs.map(async design => ({
        design,
        ...await this.evaluateDesign(design, {
          demand,
          diversity: diversities.get(design.id) ?? 0.5,
        }),
      })),
    );
  }

  getChildMutationRate(
    parentA: Design,
    parentB: Design,
    baseMutationRate: number,
    mutationWeights: Map<string, number>,
  ): number {
    const parentWeight = avg([
      mutationWeights.get(parentA.id) ?? 1,
      mutationWeights.get(parentB.id) ?? 1,
    ]);
    return round(clamp(baseMutationRate * parentWeight, 0.01, 0.75));
  }

  async verifyReplay(): Promise<ReinforcementReplaySummary> {
    const demand = createReplayDemand();
    const designs = createReplayDesigns();
    const first = await this.evaluateReplayPopulation(designs, demand);
    const second = await this.evaluateReplayPopulation(designs, demand);
    const firstChecksum = checksumDecisions(first);
    const secondChecksum = checksumDecisions(second);

    return {
      stable: firstChecksum === secondChecksum,
      checksum: firstChecksum,
      firstChecksum,
      secondChecksum,
      decisionCount: first.length,
      gateStatuses: countGateStatuses(first),
    };
  }

  private async evaluateReplayPopulation(
    designs: Design[],
    demand: DemandResult,
  ): Promise<ReinforcementDecision[]> {
    const diversities = this.calculatePopulationDiversities(designs);
    const decisions = await Promise.all(
      designs.map(async design => {
        const result = await this.evaluateDesign(design, {
          demand,
          diversity: diversities.get(design.id) ?? 0.5,
          persist: false,
        });
        return result.decision;
      }),
    );

    return decisions.sort((a, b) => a.designId.localeCompare(b.designId));
  }

  private async getDemand(): Promise<DemandResult> {
    try {
      const latest = await getStorageRepository().demand.getLatest();
      if (latest) return latest;
    } catch {
      // Database is optional for deterministic replay.
    }

    return createFallbackDemand();
  }

  private calculateAxes(design: Design, demand: DemandResult, diversity: number): ReinforcementAxes {
    return {
      demand: round(demandEngine.scoreDesign(design, demand)),
      engagement: round(clamp(design.score.engagement, 0, 1)),
      novelty: round(this.calculateNovelty(design)),
      retention: round(this.estimateRetention(design)),
      diversity: round(clamp(diversity, 0, 1)),
      stability: round(this.estimateStability(design, demand)),
    };
  }

  private shapeWeights(demand: DemandResult): ReinforcementWeights {
    const inputs = demand.reinforcementInputs || {
      demandWeight: demand.demandScore,
      trendMomentum: 0.5,
      sentimentBias: 0,
      popularityPressure: 0.5,
    };

    const shaped = normalizeWeights({
      demand: BASE_WEIGHTS.demand + (inputs.trendMomentum - 0.5) * ADAPTATION_LIMITS.maxDemandShift,
      engagement: BASE_WEIGHTS.engagement + (inputs.popularityPressure - 0.5) * ADAPTATION_LIMITS.maxEngagementShift,
      novelty: BASE_WEIGHTS.novelty + Math.max(inputs.sentimentBias, 0) * 0.04,
      retention: BASE_WEIGHTS.retention + Math.max(-inputs.sentimentBias, 0) * ADAPTATION_LIMITS.maxRetentionShift,
      diversity: BASE_WEIGHTS.diversity,
      stability: BASE_WEIGHTS.stability + (0.5 - inputs.trendMomentum) * ADAPTATION_LIMITS.maxStabilityShift,
    });

    return mapWeights(shaped, round);
  }

  private evaluateGate(axes: ReinforcementAxes, demand: DemandResult): ReinforcementGateReport {
    const sourceConfidence = demand.sourceBreakdown?.length
      ? avg(demand.sourceBreakdown.map(source => source.confidence))
      : 0.75;
    const reasons: string[] = [];
    let status: ReinforcementGateReport['status'] = 'pass';

    if (axes.stability < STRUTHIO_GATE_BOUNDARIES.minimumStability) {
      reasons.push('stability below mutation containment boundary');
      status = 'blocked';
    } else if (axes.stability < STRUTHIO_GATE_BOUNDARIES.warningStability) {
      reasons.push('stability entering warning range');
      status = 'warn';
    }

    if (sourceConfidence < STRUTHIO_GATE_BOUNDARIES.minimumConfidence) {
      reasons.push('demand confidence below reinforcement boundary');
      status = 'blocked';
    } else if (sourceConfidence < STRUTHIO_GATE_BOUNDARIES.warningConfidence && status === 'pass') {
      reasons.push('demand confidence entering warning range');
      status = 'warn';
    }

    if (reasons.length === 0) reasons.push('reinforcement boundaries stable');

    return {
      status,
      reasons,
      stabilityBoundary: STRUTHIO_GATE_BOUNDARIES.minimumStability,
      confidenceBoundary: STRUTHIO_GATE_BOUNDARIES.minimumConfidence,
      mutationBoundary: STRUTHIO_GATE_BOUNDARIES.maximumMutationWeight,
    };
  }

  private calculateMutationWeight(axes: ReinforcementAxes, gate: ReinforcementGateReport): number {
    const explorationPressure = (1 - axes.novelty) * 0.28 + axes.diversity * 0.12;
    const stabilityBrake = (1 - axes.stability) * 0.18;
    const gateBrake = gate.status === 'blocked' ? -0.45 : gate.status === 'warn' ? -0.2 : 0;
    return round(clamp(
      1 + explorationPressure - stabilityBrake + gateBrake,
      0.25,
      STRUTHIO_GATE_BOUNDARIES.maximumMutationWeight,
    ));
  }

  private createLineage(design: Design, total: number, demand: DemandResult): ReinforcementLineageEntry {
    return {
      designId: design.id,
      parentIds: design.parentIds || [],
      generation: design.generation,
      inheritedScore: round(design.score.total || 0),
      rewardChecksum: hashString(JSON.stringify({
        designId: design.id,
        generation: design.generation,
        parents: design.parentIds || [],
        total: round(total),
        demand: demand.checksum || demand.demandScore,
      })),
    };
  }

  private createReplayChecksum(
    designId: string,
    axes: ReinforcementAxes,
    weights: ReinforcementWeights,
    gate: ReinforcementGateReport,
    mutationWeight: number,
    demandChecksum: string,
  ): string {
    return hashString(JSON.stringify({
      designId,
      axes,
      weights,
      gateStatus: gate.status,
      mutationWeight,
      demandChecksum,
    }));
  }

  private calculateNovelty(design: Design): number {
    const entropyBonus = Math.min(design.content.entropy / 5, 0.5);
    const mechanicBonus = design.mechanics.featureTriggers.length * 0.05;
    return clamp(entropyBonus + mechanicBonus, 0, 1);
  }

  private estimateRetention(design: Design): number {
    const retention: Record<string, number> = {
      low: 0.85,
      medium: 0.9,
      high: 0.75,
      extreme: 0.6,
    };
    const base = retention[design.mechanics.volatilityClass] ?? 0.7;
    const feature = Math.min(design.mechanics.featureTriggers.length * 0.05, 0.1);
    return clamp(base + feature, 0, 1);
  }

  private estimateStability(design: Design, demand: DemandResult): number {
    const trendMomentum = demand.reinforcementInputs?.trendMomentum ?? 0.5;
    const volatility = volatilityLevel(design.mechanics.volatilityClass);
    const coherence = 1 - Math.abs(volatility - trendMomentum);
    const continuity = design.parentIds?.length ? 0.08 : 0;
    return clamp(coherence * 0.72 + this.estimateRetention(design) * 0.2 + continuity, 0, 1);
  }

  private calculatePopulationDiversities(population: Design[]): Map<string, number> {
    return new Map(population.map(design => [
      design.id,
      this.calculatePopulationDiversity(design, population),
    ]));
  }

  private calculatePopulationDiversity(target: Design, population: Design[]): number {
    if (population.length <= 1) return 1;
    const distances = population
      .filter(other => other.id !== target.id)
      .map(other => this.phenotypeDistance(target, other));
    return round(clamp(avg(distances) * 2, 0, 1));
  }

  private phenotypeDistance(a: Design, b: Design): number {
    const volDiff = Math.abs(volatilityLevel(a.mechanics.volatilityClass) - volatilityLevel(b.mechanics.volatilityClass));
    const intDiff = Math.abs(a.intentVector.conflictIntensity - b.intentVector.conflictIntensity);
    const themeDiff = a.intentVector.thematicCluster === b.intentVector.thematicCluster ? 0 : 0.3;
    return (volDiff + intDiff + themeDiff) / 3;
  }
}

function createFallbackDemand(): DemandResult {
  return {
    demandScore: 0.5,
    trendVector: Array(8).fill(0.5),
    keywordClusters: [],
    timestamp: 0,
    volume: 0,
    keywordVector: {},
    sourceBreakdown: [],
    reinforcementInputs: {
      demandWeight: 0.5,
      trendMomentum: 0.5,
      sentimentBias: 0,
      popularityPressure: 0.5,
    },
    checksum: 'fallback_demand',
  };
}

function createReplayDemand(): DemandResult {
  return {
    demandScore: 0.58,
    trendVector: [0.82, 0.78, 0.72, 0.68],
    keywordClusters: ['bonus', 'volatility', 'mythic', 'replay'],
    timestamp: 0,
    volume: 16,
    keywordVector: {
      bonus: 1,
      volatility: 0.82,
      mythic: 0.74,
      replay: 0.52,
    },
    sourceBreakdown: [
      { source: 'slotcatalog', signalCount: 4, sentiment: 0.2, intensity: 0.32, trendWeight: 0.8, popularity: 0.62, confidence: 0.76, keywords: ['bonus', 'volatility'] },
      { source: 'wizardofodds', signalCount: 4, sentiment: 0.1, intensity: 0.28, trendWeight: 0.72, popularity: 0.58, confidence: 0.72, keywords: ['volatility', 'rtp'] },
      { source: 'bigwinboard', signalCount: 4, sentiment: 0.25, intensity: 0.38, trendWeight: 0.76, popularity: 0.71, confidence: 0.79, keywords: ['bonus', 'replay'] },
      { source: 'github_rtp', signalCount: 4, sentiment: 0.05, intensity: 0.22, trendWeight: 0.68, popularity: 0.5, confidence: 0.7, keywords: ['simulation', 'rtp'] },
    ],
    reinforcementInputs: {
      demandWeight: 0.58,
      trendMomentum: 0.745,
      sentimentBias: 0.15,
      popularityPressure: 0.6025,
    },
    checksum: 'replay_demand_3f8149609',
  };
}

function createReplayDesigns(): Design[] {
  return [
    createReplayDesign('replay_alpha', 'mythic bonus volatility', 'high', 0.68, 0.64, 4.1, 0, []),
    createReplayDesign('replay_beta', 'rtp bonus replay', 'medium', 0.42, 0.58, 3.2, 1, ['replay_alpha']),
    createReplayDesign('replay_gamma', 'calm symbol journey', 'low', 0.24, 0.52, 2.8, 1, ['replay_alpha']),
  ];
}

function createReplayDesign(
  id: string,
  input: string,
  volatilityClass: Design['mechanics']['volatilityClass'],
  conflictIntensity: number,
  engagement: number,
  entropy: number,
  generation: number,
  parentIds: string[],
): Design {
  return {
    id,
    seed: id,
    timestamp: 0,
    input,
    mode: 'FULL',
    intentVector: {
      conflictIntensity,
      volatilitySignal: conflictIntensity,
      symbolicDensity: 0.6,
      aestheticIntensity: 0.56,
      thematicCluster: input.split(' ')[0],
      contentComplexity: 0.52,
      renderingMode: 'symbolic',
    },
    mechanics: {
      volatilityClass,
      bonusLogic: 'replay_bonus',
      featureTriggers: ['bonus', 'replay', 'symbol'],
      payoutBehavior: 'medium_sustained',
      poeticStrategy: 'symbolic',
    },
    content: {
      type: 'symbolic',
      content: input,
      entropy,
      poetryTechnique: 'replay',
    },
    score: {
      total: engagement,
      demand: 0.5,
      engagement,
      novelty: 0.5,
      retention: 0.5,
    },
    generation,
    parentIds,
  };
}

function weightedScore(axes: ReinforcementAxes, weights: ReinforcementWeights): number {
  return round(clamp(
    axes.demand * weights.demand +
    axes.engagement * weights.engagement +
    axes.novelty * weights.novelty +
    axes.retention * weights.retention +
    axes.diversity * weights.diversity +
    axes.stability * weights.stability,
    0,
    1,
  ));
}

function normalizeWeights(weights: ReinforcementWeights): ReinforcementWeights {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  return mapWeights(weights, value => value / total);
}

function mapWeights(weights: ReinforcementWeights, fn: (value: number) => number): ReinforcementWeights {
  return {
    demand: fn(weights.demand),
    engagement: fn(weights.engagement),
    novelty: fn(weights.novelty),
    retention: fn(weights.retention),
    diversity: fn(weights.diversity),
    stability: fn(weights.stability),
  };
}

function checksumDecisions(decisions: ReinforcementDecision[]): string {
  return hashString(JSON.stringify(decisions.map(decision => ({
    designId: decision.designId,
    total: decision.total,
    gate: decision.gate.status,
    mutationWeight: decision.mutationWeight,
    replayChecksum: decision.replayChecksum,
  }))));
}

function countGateStatuses(decisions: ReinforcementDecision[]): Record<string, number> {
  return decisions.reduce<Record<string, number>>((counts, decision) => {
    counts[decision.gate.status] = (counts[decision.gate.status] || 0) + 1;
    return counts;
  }, {});
}

function volatilityLevel(level: Design['mechanics']['volatilityClass']): number {
  const levels: Record<Design['mechanics']['volatilityClass'], number> = {
    low: 0.15,
    medium: 0.45,
    high: 0.72,
    extreme: 0.95,
  };
  return levels[level];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export const reinforcementEngine = new ReinforcementEngine();
