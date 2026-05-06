import { Design, EvolutionState } from '../types';
import { DemandDB } from '../storage/db';
import { demandEngine } from './demandEngine';

export interface RewardBreakdown {
  total: number;
  demand: number;
  engagement: number;
  novelty: number;
  retention: number;
  diversity: number;
}

export class ReinforcementEngine {
  async evaluateDesign(design: Design): Promise<RewardBreakdown> {
    const demand = await this.getDemand();

    const demandScore = demandEngine.scoreDesign(design, demand);
    const engagement = design.score.engagement;
    const novelty = this.calculateNovelty(design);
    const retention = this.estimateRetention(design);
    const diversity = 0.5; // Calculated at population level

    const total = clamp(
      demandScore * 0.4 +
      engagement * 0.2 +
      novelty * 0.2 +
      retention * 0.2,
      0, 1,
    );

    return { total, demand: demandScore, engagement, novelty, retention, diversity };
  }

  async evaluatePopulation(designs: Design[]): Promise<Array<RewardBreakdown & { design: Design }>> {
    const results = await Promise.all(
      designs.map(async design => {
        const breakdown = await this.evaluateDesign(design);
        breakdown.diversity = this.calculatePopulationDiversity(design, designs);
        return { design, ...breakdown };
      }),
    );

    return results.map(r => ({
      ...r,
      total: clamp(r.total + r.diversity * 0.1, 0, 1),
    }));
  }

  private async getDemand() {
    const latest = DemandDB.getLatest();
    if (latest) return latest;
    setTimeout(() => demandEngine.updateDemand(), 0);
    return { demandScore: 0.5, trendVector: Array(10).fill(0.5), keywordClusters: [], timestamp: Date.now() };
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

  private calculatePopulationDiversity(target: Design, population: Design[]): number {
    const distances = population.map(other => this.phenotypeDistance(target, other));
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    return clamp(avg * 2, 0, 1);
  }

  private phenotypeDistance(a: Design, b: Design): number {
    const levels = ['low', 'medium', 'high', 'extreme'];
    const volDiff = Math.abs(levels.indexOf(a.mechanics.volatilityClass) - levels.indexOf(b.mechanics.volatilityClass)) / 3;
    const intDiff = Math.abs(a.intentVector.conflictIntensity - b.intentVector.conflictIntensity);
    const themeDiff = a.intentVector.thematicCluster === b.intentVector.thematicCluster ? 0 : 0.3;
    return (volDiff + intDiff + themeDiff) / 3;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export const reinforcementEngine = new ReinforcementEngine();
