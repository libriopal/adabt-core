import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase5] ${label}`);
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
  console.error('[phase5] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('replay recovery actions smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');
      const {
        diffReplayCheckpoints,
        getReplayHistory,
        monitorReplayHistory,
      } = require('./apps/backend/src/diagnostics/replayHistory');
      const { createContinuityExport } = require('./apps/backend/src/diagnostics/continuityExport');

      initDatabase(':memory:');
      await runReplaySuite();
      await runReplaySuite();

      const beforeRecovery = await getReplayHistory(undefined, 10);
      const recoveryReplay = await runReplaySuite({ persist: false });
      const afterRecovery = await getReplayHistory(undefined, 10);
      if (!recoveryReplay.stable) throw new Error('recovery replay should verify');
      if (recoveryReplay.persistence) throw new Error('recovery replay should not append persistence');
      if (afterRecovery.verification.eventCount !== beforeRecovery.verification.eventCount) {
        throw new Error('recovery replay should not append events');
      }

      const [target, base] = afterRecovery.checkpoints;
      const diff = await diffReplayCheckpoints(base.id, target.id);
      if (diff.eventDelta <= 0) throw new Error('checkpoint diff should advance event count');
      if (diff.checkDeltas.length === 0) throw new Error('checkpoint diff should include check deltas');

      const monitor = await monitorReplayHistory();
      if (monitor.status !== 'ready') throw new Error('replay monitor should be ready');

      const bundle = await createContinuityExport({ checkpointId: target.id, limit: 10 });
      if (bundle.anchor?.id !== target.id) throw new Error('continuity export anchor mismatch');

      console.log(JSON.stringify({
        events: afterRecovery.verification.eventCount,
        eventDelta: diff.eventDelta,
        monitor: monitor.status,
        exportChecksum: bundle.exportChecksum,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 4 validation chain', 'npm', ['run', 'validate:phase4']);
