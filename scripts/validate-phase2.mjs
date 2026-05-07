import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase2] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...env },
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!existsSync(tsx)) {
  console.error('[phase2] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('sqlite async repository smoke', tsx, [
  '-e',
  `
    (async () => {
    const { initDatabase } = require('./apps/backend/src/storage/db');
    const { getStorageRepository } = require('./apps/backend/src/storage/repository');

    initDatabase(':memory:');
    const repo = getStorageRepository();
    const design = {
      id: 'phase2_design',
      seed: 'phase2_seed',
      timestamp: 1,
      input: 'phase2',
      mode: 'FAST',
      intentVector: {
        conflictIntensity: 0.5,
        volatilitySignal: 0.5,
        symbolicDensity: 0.5,
        aestheticIntensity: 0.5,
        thematicCluster: 'phase2',
        contentComplexity: 0.5,
        renderingMode: 'direct',
      },
      mechanics: {
        volatilityClass: 'medium',
        bonusLogic: 'phase2_bonus',
        featureTriggers: ['phase2'],
        payoutBehavior: 'phase2_payout',
        poeticStrategy: 'literal',
      },
      content: {
        type: 'literal',
        content: 'phase2 repository smoke',
        entropy: 1,
        poetryTechnique: 'none',
      },
      score: {
        total: 0.7,
        demand: 0.6,
        engagement: 0.5,
        novelty: 0.4,
        retention: 0.3,
      },
      generation: 0,
    };

    await repo.designs.create(design);
    const stored = await repo.designs.getById('phase2_design');
    if (!stored || stored.score.total !== 0.7) throw new Error('design repository smoke failed');

    await repo.demand.save({
      demandScore: 0.55,
      trendVector: [0.55],
      keywordClusters: ['phase2'],
      timestamp: 2,
    });
    const demand = await repo.demand.getLatest();
    if (!demand || demand.keywordClusters[0] !== 'phase2') throw new Error('demand repository smoke failed');

    await repo.reinforcement.save({
      id: 'phase2_reinforcement',
      designId: 'phase2_design',
      total: 0.7,
      axes: { demand: 0.6, engagement: 0.5, novelty: 0.4, retention: 0.3, diversity: 0.2, stability: 0.9 },
      weights: { demand: 0.34, engagement: 0.16, novelty: 0.16, retention: 0.14, diversity: 0.1, stability: 0.1 },
      gate: { status: 'pass', reasons: [], stabilityBoundary: 0.8, confidenceBoundary: 0.7, mutationBoundary: 0.2 },
      mutationWeight: 0.1,
      lineage: { designId: 'phase2_design', parentIds: [], generation: 0, inheritedScore: 0.7, rewardChecksum: 'phase2' },
      demandChecksum: 'phase2_demand',
      replayChecksum: 'phase2_replay',
    });
    const recent = await repo.reinforcement.getLatest(1);
    if (recent[0]?.id !== 'phase2_reinforcement') throw new Error('reinforcement repository smoke failed');

    await repo.evolutionRuns.create({
      runId: 'phase2_run',
      currentGeneration: 0,
      maxGenerations: 10,
      populationSize: 10,
      mutationRate: 0.1,
      eliteRatio: 0.2,
      designs: [design],
      history: [],
      status: 'running',
      config: {
        populationSize: 10,
        maxGenerations: 10,
        mutationRate: 0.1,
        crossoverRate: 0.7,
        eliteRatio: 0.2,
        parallelBatches: 1,
      },
    });
    await repo.evolutionRuns.update('phase2_run', { status: 'paused' });
    const run = await repo.evolutionRuns.getById('phase2_run');
    if (!run || run.status !== 'paused') throw new Error('evolution repository smoke failed');

    console.log(JSON.stringify({ provider: repo.provider, repository: 'ready' }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('production postgres config guard', tsx, [
  '-e',
  `
    (async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_PROVIDER = 'postgres';
    delete process.env.DATABASE_URL;
    const { validateRuntimeEnvironment } = require('./apps/backend/src/diagnostics/runtimeValidation');
    const runtime = validateRuntimeEnvironment();
    if (runtime.status !== 'degraded') throw new Error('postgres guard should degrade runtime without DATABASE_URL');
    if (!runtime.warnings.some(w => w.includes('DATABASE_URL'))) throw new Error('postgres guard warning missing');
    console.log(JSON.stringify({ status: runtime.status, warnings: runtime.warnings }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 1 validation chain', 'npm', ['run', 'validate:phase1']);
