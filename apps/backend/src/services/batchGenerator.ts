import { BatchConfig, Design, IntentVector, SlotMechanics } from '../types';
import { DeterministicPRNG } from '../utils/prng';
import { DesignDB } from '../storage/db';
import { demandEngine } from './demandEngine';

export class BatchGenerator {
  async generateBatch(config: BatchConfig): Promise<Design[]> {
    const designs: Design[] = [];
    const prng = new DeterministicPRNG(config.inputBase + Date.now());
    const demand = await demandEngine.updateDemand(config.inputBase);

    for (let i = 0; i < config.count; i++) {
      const seed = `${config.inputBase}_batch${i}_${Date.now()}`;
      const design = config.mode === 'FAST'
        ? this.generateFastVariant(config.inputBase, seed, i, prng)
        : this.generateFullVariant(config.inputBase, seed, i, prng, config, demand);
      designs.push(design);
    }

    designs.forEach(d => {
      try { DesignDB.create(d as any); } catch { /* non-fatal in tests */ }
    });

    return designs;
  }

  private generateFastVariant(
    input: string,
    seed: string,
    index: number,
    prng: DeterministicPRNG,
  ): Design {
    const bases = ['cyberpunk', 'fantasy', 'noir', 'retro', 'tribal'];
    const base = prng.pick(bases);
    const id = `fast_${seed.slice(-10)}_${index}`;

    return {
      id,
      seed,
      timestamp: Date.now(),
      input: `${input} [FAST:${base}:${index}]`,
      mode: 'FAST',
      intentVector: {
        conflictIntensity: prng.nextFloat(0.3, 0.7),
        volatilitySignal: prng.nextFloat(0.3, 0.7),
        symbolicDensity: prng.nextFloat(0.4, 0.8),
        aestheticIntensity: prng.nextFloat(0.5, 0.9),
        thematicCluster: base,
        contentComplexity: 0.5,
        renderingMode: 'direct',
      },
      mechanics: {
        volatilityClass: prng.pick(['low', 'medium', 'high'] as SlotMechanics['volatilityClass'][]),
        bonusLogic: `cascading_${prng.pick(['standard', 'enhanced'])}`,
        featureTriggers: ['wild_expansion', 'scatter_bonus'].slice(0, prng.nextInt(1, 2)),
        payoutBehavior: 'medium_sustained',
        poeticStrategy: 'literal',
      },
      content: {
        type: 'literal',
        content: `Fast-generated ${base} slot system`,
        entropy: prng.nextFloat(1, 3),
        poetryTechnique: 'none',
      },
      score: {
        total: prng.nextFloat(0.4, 0.7),
        demand: 0.5,
        engagement: 0.5,
        novelty: 0.5,
        retention: 0.5,
      },
      generation: 0,
    };
  }

  private generateFullVariant(
    input: string,
    seed: string,
    index: number,
    prng: DeterministicPRNG,
    config: BatchConfig,
    demand: any,
  ): Design {
    const id = `full_${seed.substring(0, 8)}_${index}`;

    const intentVector: IntentVector = {
      conflictIntensity: this.analyzeConflict(input, prng),
      volatilitySignal: this.detectVolatility(input, prng),
      symbolicDensity: prng.nextFloat(0.4, 0.9),
      aestheticIntensity: prng.nextFloat(0.5, 1.0),
      thematicCluster: this.identifyTheme(input, prng),
      contentComplexity: prng.nextFloat(0.3, 0.8),
      renderingMode: prng.next() > 0.5 ? 'symbolic' : 'encoded',
    };

    const mechanics: SlotMechanics = {
      volatilityClass: this.determineVolatility(intentVector.conflictIntensity),
      bonusLogic: this.constructBonusLogic(intentVector.volatilitySignal, prng),
      featureTriggers: this.generateFeatures(intentVector.symbolicDensity, prng),
      payoutBehavior: this.designPayout(intentVector.aestheticIntensity),
      poeticStrategy: intentVector.renderingMode === 'encoded' ? 'encodedVerse' : 'symbolic',
      differentialCurve: config.differentialCurve || 'sigmoid',
    };

    mechanics.volatilityClass = this.applyDifferentialCurve(
      mechanics.volatilityClass,
      config.differentialCurve || 'sigmoid',
      prng,
    );

    const content = this.renderContent(mechanics, prng);
    const demandScore = demandEngine.scoreDesign({ intentVector } as Design, demand);
    const engagement = prng.nextFloat(0.4, 0.9);
    const novelty = prng.nextFloat(0.3, 0.8);
    const retention = prng.nextFloat(0.4, 0.85);
    const totalScore = clamp(demandScore * 0.4 + engagement * 0.2 + novelty * 0.2 + retention * 0.2, 0, 1);

    return {
      id,
      seed,
      timestamp: Date.now(),
      input: `${input} [FULL:${index}]`,
      mode: 'FULL',
      intentVector,
      mechanics,
      content,
      score: { total: totalScore, demand: demandScore, engagement, novelty, retention },
      generation: 0,
    };
  }

  private analyzeConflict(input: string, prng: DeterministicPRNG): number {
    const markers = ['war', 'battle', 'fight', 'conflict', 'vs'];
    const count = markers.filter(m => input.toLowerCase().includes(m)).length;
    return clamp((count / 3) + prng.nextFloat(-0.1, 0.1), 0, 1);
  }

  private detectVolatility(input: string, prng: DeterministicPRNG): number {
    const highVol = ['chaos', 'wild', 'extreme', 'madness'];
    const lowVol = ['calm', 'peace', 'zen', 'relax'];
    let score = 0.5;
    highVol.forEach(w => { if (input.includes(w)) score += 0.2; });
    lowVol.forEach(w => { if (input.includes(w)) score -= 0.2; });
    return clamp(score + prng.nextFloat(-0.05, 0.05), 0, 1);
  }

  private identifyTheme(input: string, prng: DeterministicPRNG): string {
    const themes = ['cyberpunk', 'fantasy', 'horror', 'western', 'noir', 'space'];
    const found = themes.find(t => input.toLowerCase().includes(t));
    return found || prng.pick(themes);
  }

  private determineVolatility(intensity: number): SlotMechanics['volatilityClass'] {
    if (intensity < 0.25) return 'low';
    if (intensity < 0.5) return 'medium';
    if (intensity < 0.75) return 'high';
    return 'extreme';
  }

  private constructBonusLogic(volatility: number, prng: DeterministicPRNG): string {
    const types = ['free_spins', 'cascading', 'expanding_wilds', 'pick_bonus'];
    const type = prng.pick(types);
    const freq = volatility > 0.6 ? 'high_freq' : 'medium_freq';
    return `${type}_${freq}`;
  }

  private generateFeatures(density: number, prng: DeterministicPRNG): string[] {
    const all = ['wild_expansion', 'scatter_trigger', 'mystery_symbol', 'colossal_reel', 'multiplier_trail'];
    const count = Math.max(1, Math.floor(density * all.length));
    return prng.shuffle(all).slice(0, count);
  }

  private designPayout(intensity: number): string {
    return intensity > 0.7 ? 'high_variance_burst' : intensity > 0.4 ? 'medium_sustained' : 'low_consistent';
  }

  private applyDifferentialCurve(
    current: SlotMechanics['volatilityClass'],
    curve: string,
    prng: DeterministicPRNG,
  ): SlotMechanics['volatilityClass'] {
    const levels: SlotMechanics['volatilityClass'][] = ['low', 'medium', 'high', 'extreme'];
    const idx = levels.indexOf(current);
    switch (curve) {
      case 'linear': return levels[Math.min(idx + 1, 3)];
      case 'exponential': return idx >= 2 ? 'extreme' : levels[idx + 1];
      case 'parabola': return prng.next() > 0.5 ? levels[Math.min(idx + 1, 3)] : current;
      case 'sigmoid':
      default: return prng.next() > 0.7 ? levels[Math.min(idx + 1, 3)] : current;
    }
  }

  private renderContent(mechanics: SlotMechanics, prng: DeterministicPRNG): Design['content'] {
    const techniques = ['semantic_subtraction', 'fibonacci_distortion', 'metaphysical_conceit'];
    return {
      type: mechanics.poeticStrategy,
      content: `Apparatus Status: ${mechanics.volatilityClass} system with ${mechanics.bonusLogic} [SYSTEM: ONLINE]`,
      entropy: prng.nextFloat(2, 5),
      poetryTechnique: prng.pick(techniques),
    };
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export const batchGenerator = new BatchGenerator();
