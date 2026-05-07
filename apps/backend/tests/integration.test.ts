import { describe, it, expect, beforeAll } from 'vitest';
import { batchGenerator } from '../src/services/batchGenerator';
import { demandEngine } from '../src/services/demandEngine';
import { evolutionEngine } from '../src/services/evolutionEngine';
import { initDatabase } from '../src/storage/db';

beforeAll(() => {
  initDatabase(':memory:');
});

describe('Integration Tests', () => {
  it('should generate FAST batch', async () => {
    const designs = await batchGenerator.generateBatch({
      count: 5,
      mode: 'FAST',
      inputBase: 'cyberpunk heist',
    });

    expect(designs).toHaveLength(5);
    expect(designs[0].mode).toBe('FAST');
    expect(designs[0].score.total).toBeGreaterThan(0);
  });

  it('should generate FULL batch', async () => {
    const designs = await batchGenerator.generateBatch({
      count: 3,
      mode: 'FULL',
      inputBase: 'fantasy warfare',
      differentialCurve: 'sigmoid',
    });

    expect(designs).toHaveLength(3);
    expect(designs[0].mechanics.differentialCurve).toBe('sigmoid');
    expect(designs[0].content.entropy).toBeGreaterThan(0);
  });

  it('should start and query evolution', async () => {
    const seeds = await batchGenerator.generateBatch({
      count: 10,
      mode: 'FAST',
      inputBase: 'test',
    });

    const runId = await evolutionEngine.startEvolution(seeds, {
      populationSize: 10,
      maxGenerations: 5,
      mutationRate: 0.1,
      eliteRatio: 0.2,
      crossoverRate: 0.7,
      parallelBatches: 2,
    });

    expect(runId).toBeDefined();

    const state = evolutionEngine.getState(runId);
    expect(state).toBeDefined();
    expect(state?.status).toBe('running');
  });

  it('should compute source-weighted demand intelligence', async () => {
    const demand = await demandEngine.updateDemand('mythic bonus volatility');

    expect(demand.demandScore).toBeGreaterThan(0);
    expect(demand.keywordClusters.length).toBeGreaterThan(0);
    expect(demand.sourceBreakdown?.length).toBeGreaterThan(1);
    expect(demand.reinforcementInputs?.demandWeight).toBeGreaterThan(0);
    expect(demand.checksum).toBeDefined();
  });
});
