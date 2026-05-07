import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase6] ${label}`);
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
  console.error('[phase6] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('replay observability persistence smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const { getStorageRepository } = require('./apps/backend/src/storage/repository');
      const { createDegradedReplayExport } = require('./apps/backend/src/diagnostics/continuityExport');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');
      const {
        acknowledgeReplayMonitorSnapshot,
        getReplayMonitorHistory,
        monitorReplayHistory,
      } = require('./apps/backend/src/diagnostics/replayHistory');

      initDatabase(':memory:');
      await runReplaySuite();
      await runReplaySuite();

      const monitor = await monitorReplayHistory();
      if (!monitor.snapshotId) throw new Error('monitor should persist a snapshot id');

      const snapshots = await getReplayMonitorHistory(undefined, 10);
      if (snapshots.length === 0) throw new Error('monitor history should include snapshots');
      if (snapshots[0].id !== monitor.snapshotId) throw new Error('latest monitor snapshot mismatch');

      const acknowledged = await acknowledgeReplayMonitorSnapshot(monitor.snapshotId, 'phase6-smoke');
      if (!acknowledged.acknowledgedAt) throw new Error('monitor acknowledgement should set timestamp');
      if (acknowledged.acknowledgedBy !== 'phase6-smoke') throw new Error('monitor acknowledgement actor mismatch');

      const degradedExport = await createDegradedReplayExport({ snapshotId: monitor.snapshotId, limit: 10 });
      if (degradedExport.version !== 'agros-degraded-replay-export-v1') {
        throw new Error('degraded export version mismatch');
      }
      if (degradedExport.monitorSnapshot?.id !== monitor.snapshotId) {
        throw new Error('degraded export should anchor to monitor snapshot');
      }
      if (degradedExport.recommendations.length === 0) {
        throw new Error('degraded export should include recovery recommendations');
      }

      const repositorySnapshots = await getStorageRepository().replayMonitorSnapshots.getLatest(undefined, 10);
      if (repositorySnapshots.length < snapshots.length) {
        throw new Error('repository monitor snapshots should be queryable without stream');
      }

      console.log(JSON.stringify({
        snapshots: repositorySnapshots.length,
        acknowledged: acknowledged.id,
        recommendations: degradedExport.recommendations.length,
        exportChecksum: degradedExport.exportChecksum,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 5 validation chain', 'npm', ['run', 'validate:phase5']);
