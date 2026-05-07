import { Design, EvolutionState, EvolutionConfig, GenerationSnapshot, SlotMechanics } from '../types';
import { DeterministicPRNG } from '../utils/prng';
import { DesignDB, EvolutionDB } from '../storage/db';
import { reinforcementEngine, RewardBreakdown } from './reinforcementEngine';

export class EvolutionEngine {
  private activeRuns: Map<string, EvolutionState> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  async startEvolution(initialDesigns: Design[], config: EvolutionConfig): Promise<string> {
    const runId = `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const state: EvolutionState = {
      runId,
      currentGeneration: 0,
      maxGenerations: config.maxGenerations,
      populationSize: config.populationSize,
      mutationRate: config.mutationRate,
      eliteRatio: config.eliteRatio,
      designs: initialDesigns,
      history: [],
      status: 'running',
      config,
    };

    this.activeRuns.set(runId, state);
    this.abortControllers.set(runId, new AbortController());

    try { EvolutionDB.create(state); } catch { /* non-fatal */ }

    this.runEvolutionLoop(runId, state, this.abortControllers.get(runId)!.signal);
    return runId;
  }

  async resumeEvolution(runId: string): Promise<boolean> {
    const dbRun = EvolutionDB.getById(runId);
    if (!dbRun || dbRun.status !== 'paused') return false;

    const state = dbRun as unknown as EvolutionState;
    state.status = 'running';

    this.activeRuns.set(runId, state);
    this.abortControllers.set(runId, new AbortController());

    this.runEvolutionLoop(runId, state, this.abortControllers.get(runId)!.signal);
    return true;
  }

  pauseEvolution(runId: string): boolean {
    const controller = this.abortControllers.get(runId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(runId);
    }

    const state = this.activeRuns.get(runId);
    if (state) {
      state.status = 'paused';
      try { EvolutionDB.update(runId, { status: 'paused' }); } catch { /* non-fatal */ }
    }

    return !!state;
  }

  getState(runId: string): EvolutionState | undefined {
    const mem = this.activeRuns.get(runId);
    if (mem) return mem;
    try {
      const db = EvolutionDB.getById(runId);
      return db as unknown as EvolutionState | undefined;
    } catch {
      return undefined;
    }
  }

  getActiveRuns(): string[] {
    return Array.from(this.activeRuns.entries())
      .filter(([, state]) => state.status === 'running')
      .map(([id]) => id);
  }

  private async runEvolutionLoop(
    runId: string,
    state: EvolutionState,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      while (state.currentGeneration < state.maxGenerations && !signal.aborted) {
        console.log(`[Evolution ${runId}] Generation ${state.currentGeneration + 1}/${state.maxGenerations}`);

        const evaluated = await reinforcementEngine.evaluatePopulation(state.designs);

        evaluated.forEach(e => {
          e.design.score = { total: e.total, demand: e.demand, engagement: e.engagement, novelty: e.novelty, retention: e.retention };
        });

        const snapshot = this.createSnapshot(state.currentGeneration, evaluated);
        state.history.push(snapshot);

        if (this.shouldTerminate(state)) {
          state.status = 'completed';
          break;
        }

        const parents = this.selectParents(evaluated, state);
        const mutationWeights = new Map(evaluated.map(e => [e.design.id, e.mutationWeight]));
        state.designs = this.generateNextGeneration(parents, state, signal, mutationWeights);
        state.currentGeneration++;

        try {
          EvolutionDB.update(runId, {
            currentGeneration: state.currentGeneration,
            history: state.history,
            status: state.status,
            designs: state.designs,
          });
        } catch { /* non-fatal */ }

        // Yield to event loop
        await new Promise(r => setTimeout(r, 10));
      }

      if (!signal.aborted && state.status === 'running') {
        state.status = 'completed';
      }
    } catch (error) {
      console.error(`[Evolution ${runId}] Error:`, error);
      state.status = 'error';
    } finally {
      try {
        EvolutionDB.update(runId, {
          currentGeneration: state.currentGeneration,
          history: state.history,
          status: state.status,
        });
      } catch { /* non-fatal */ }
      this.activeRuns.delete(runId);
      this.abortControllers.delete(runId);
    }
  }

  private createSnapshot(
    generation: number,
    evaluated: Array<RewardBreakdown & { design: Design }>,
  ): GenerationSnapshot {
    const scores = evaluated.map(e => e.total);
    return {
      generation,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      maxScore: Math.max(...scores),
      minScore: Math.min(...scores),
      diversity: this.calculateDiversity(evaluated.map(e => e.design)),
      timestamp: Date.now(),
    };
  }

  private calculateDiversity(designs: Design[]): number {
    if (designs.length < 2) return 1;
    let total = 0;
    let pairs = 0;
    for (let i = 0; i < designs.length; i++) {
      for (let j = i + 1; j < designs.length; j++) {
        total += this.designDistance(designs[i], designs[j]);
        pairs++;
      }
    }
    return pairs > 0 ? total / pairs : 1;
  }

  private designDistance(a: Design, b: Design): number {
    const levels = { low: 0, medium: 1, high: 2, extreme: 3 };
    const volDiff = Math.abs(levels[a.mechanics.volatilityClass] - levels[b.mechanics.volatilityClass]) / 3;
    const intDiff = Math.abs(a.intentVector.conflictIntensity - b.intentVector.conflictIntensity);
    return (volDiff + intDiff) / 2;
  }

  private shouldTerminate(state: EvolutionState): boolean {
    if (state.history.length < 10) return false;
    const recent = state.history.slice(-10);
    const avgImprovement = recent.reduce((sum, h, i) => {
      if (i === 0) return 0;
      return sum + (h.maxScore - recent[i - 1].maxScore);
    }, 0) / 9;
    return avgImprovement < 0.001;
  }

  private selectParents(
    evaluated: Array<RewardBreakdown & { design: Design }>,
    state: EvolutionState,
  ): Design[] {
    const sorted = [...evaluated].sort((a, b) => b.total - a.total);
    const eliteCount = Math.floor(state.populationSize * state.eliteRatio);
    const elites = sorted.slice(0, eliteCount).map(e => e.design);

    const rest: Design[] = [];
    const prng = new DeterministicPRNG(state.runId + state.currentGeneration);

    while (rest.length < state.populationSize - eliteCount) {
      const tournament = prng.shuffle([...sorted]).slice(0, 3);
      tournament.sort((a, b) => b.total - a.total);
      rest.push(tournament[0].design);
    }

    return [...elites, ...rest];
  }

  private generateNextGeneration(
    parents: Design[],
    state: EvolutionState,
    signal: AbortSignal,
    mutationWeights: Map<string, number> = new Map(),
  ): Design[] {
    const newGeneration: Design[] = [];
    const prng = new DeterministicPRNG(`${state.runId}_${state.currentGeneration}`);
    const eliteCount = Math.floor(state.populationSize * state.eliteRatio);

    newGeneration.push(...parents.slice(0, eliteCount));

    while (newGeneration.length < state.populationSize && !signal.aborted) {
      const parent1 = prng.pick(parents);
      const parent2 = prng.pick(parents);
      const child = this.crossover(parent1, parent2, prng, state.runId, state.currentGeneration);
      const mutationRate = reinforcementEngine.getChildMutationRate(parent1, parent2, state.mutationRate, mutationWeights);
      this.mutate(child, mutationRate, prng);
      newGeneration.push(child);
    }

    return newGeneration.slice(0, state.populationSize);
  }

  private crossover(
    a: Design,
    b: Design,
    prng: DeterministicPRNG,
    runId: string,
    generation: number,
  ): Design {
    const id = `gen${generation}_${prng.next().toString(36).substr(2, 6)}`;
    const alpha = prng.next();

    const intentVector = {
      conflictIntensity: a.intentVector.conflictIntensity * alpha + b.intentVector.conflictIntensity * (1 - alpha),
      volatilitySignal: a.intentVector.volatilitySignal * alpha + b.intentVector.volatilitySignal * (1 - alpha),
      symbolicDensity: a.intentVector.symbolicDensity * alpha + b.intentVector.symbolicDensity * (1 - alpha),
      aestheticIntensity: a.intentVector.aestheticIntensity * alpha + b.intentVector.aestheticIntensity * (1 - alpha),
      thematicCluster: prng.next() > 0.5 ? a.intentVector.thematicCluster : b.intentVector.thematicCluster,
      contentComplexity: a.intentVector.contentComplexity * alpha + b.intentVector.contentComplexity * (1 - alpha),
      renderingMode: prng.next() > 0.5 ? a.intentVector.renderingMode : b.intentVector.renderingMode,
    };

    const mechanics: SlotMechanics = {
      volatilityClass: prng.next() > 0.5 ? a.mechanics.volatilityClass : b.mechanics.volatilityClass,
      bonusLogic: prng.next() > 0.5 ? a.mechanics.bonusLogic : b.mechanics.bonusLogic,
      featureTriggers: [...new Set([...a.mechanics.featureTriggers, ...b.mechanics.featureTriggers])].slice(0, 4),
      payoutBehavior: prng.next() > 0.5 ? a.mechanics.payoutBehavior : b.mechanics.payoutBehavior,
      poeticStrategy: prng.next() > 0.5 ? a.mechanics.poeticStrategy : b.mechanics.poeticStrategy,
      differentialCurve: prng.next() > 0.5 ? a.mechanics.differentialCurve : b.mechanics.differentialCurve,
    };

    return {
      id,
      seed: `${runId}_${id}`,
      timestamp: Date.now(),
      input: `Crossover of ${a.id} + ${b.id}`,
      mode: 'FULL',
      intentVector,
      mechanics,
      content: {
        type: prng.next() > 0.5 ? a.content.type : b.content.type,
        content: prng.next() > 0.5 ? a.content.content : b.content.content,
        entropy: a.content.entropy * 0.5 + b.content.entropy * 0.5,
        poetryTechnique: prng.next() > 0.5 ? a.content.poetryTechnique : b.content.poetryTechnique,
      },
      score: { total: 0, demand: 0, engagement: 0, novelty: 0, retention: 0 },
      generation,
      parentIds: [a.id, b.id],
    };
  }

  private mutate(design: Design, mutationRate: number, prng: DeterministicPRNG): void {
    if (prng.next() > mutationRate) return;

    const volLevels: SlotMechanics['volatilityClass'][] = ['low', 'medium', 'high', 'extreme'];
    const currentIdx = volLevels.indexOf(design.mechanics.volatilityClass);

    if (prng.next() < mutationRate) {
      const shift = prng.next() > 0.5 ? 1 : -1;
      design.mechanics.volatilityClass = volLevels[clamp(currentIdx + shift, 0, 3)];
    }

    if (prng.next() < mutationRate && design.mechanics.featureTriggers.length > 1) {
      design.mechanics.featureTriggers = design.mechanics.featureTriggers.slice(0, -1);
    }

    if (prng.next() < mutationRate) {
      design.content.entropy = clamp(design.content.entropy + prng.nextGaussian(0, 0.5), 1, 6);
    }
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export const evolutionEngine = new EvolutionEngine();
