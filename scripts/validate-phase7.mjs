import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase7] ${label}`);
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
  console.error('[phase7] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('release readiness gate smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const { getStorageRepository } = require('./apps/backend/src/storage/repository');
      const { collectReleaseReadiness } = require('./apps/backend/src/diagnostics/releaseReadiness');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');

      initDatabase(':memory:');
      await runReplaySuite();
      await runReplaySuite();

      const ready = await collectReleaseReadiness();
      if (ready.status !== 'ready') throw new Error('release readiness should start ready');
      if (!ready.gates.every(gate => gate.status === 'ready')) {
        throw new Error('all release gates should be ready for stable replay');
      }

      const repository = getStorageRepository();
      const alertSnapshot = await repository.replayMonitorSnapshots.save({
        id: 'monitor_phase7_unacked',
        stream: 'agros-replay-suite',
        status: 'degraded',
        checkedAt: Date.now() + 1000,
        eventCount: ready.replayMonitor.verification.eventCount,
        checkpointCount: ready.replayMonitor.verification.checkpointCount,
        latestCheckpointId: ready.replayMonitor.verification.latestCheckpointId,
        alertCount: 1,
        alerts: ['phase7 simulated release alert'],
        report: { status: 'degraded', source: 'phase7-smoke' },
      });

      const blocked = await collectReleaseReadiness({ persistMonitor: false });
      if (blocked.status !== 'blocked') throw new Error('unacknowledged alert should block release');
      if (!blocked.gates.some(gate => gate.name === 'alert_acknowledgement' && gate.status === 'blocked')) {
        throw new Error('alert acknowledgement gate should block release');
      }

      await repository.replayMonitorSnapshots.acknowledge(alertSnapshot.id, 'phase7-smoke');
      const accepted = await collectReleaseReadiness({ persistMonitor: false });
      if (accepted.status !== 'ready') throw new Error('acknowledged alert should unblock stable release');

      console.log(JSON.stringify({
        ready: ready.status,
        blocked: blocked.status,
        accepted: accepted.status,
        gates: accepted.gates.map(gate => gate.name),
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 6 validation chain', 'npm', ['run', 'validate:phase6']);
