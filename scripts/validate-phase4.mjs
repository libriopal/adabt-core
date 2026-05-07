import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase4] ${label}`);
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
  console.error('[phase4] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('replay operations and continuity export smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');
      const { getReplayHistory } = require('./apps/backend/src/diagnostics/replayHistory');
      const { createContinuityExport } = require('./apps/backend/src/diagnostics/continuityExport');
      const { continuityHub } = require('./apps/backend/src/diagnostics/continuityHub');

      initDatabase(':memory:');
      await runReplaySuite();
      await runReplaySuite();

      const history = await getReplayHistory(undefined, 10);
      if (!history.verification.stable) throw new Error('replay history should verify');
      if (history.checkpoints.length < 2) throw new Error('checkpoint comparison needs at least two checkpoints');

      const [target, base] = history.checkpoints;
      const eventDelta = target.eventCount - base.eventCount;
      if (eventDelta <= 0) throw new Error('latest checkpoint should advance event count');

      continuityHub.publish({
        type: 'diagnostic',
        timestamp: Date.now(),
        payload: { phase: 4, checkpointId: target.id },
      });

      const bundle = await createContinuityExport({ checkpointId: target.id, limit: 10 });
      if (bundle.anchor?.id !== target.id) throw new Error('continuity export anchor mismatch');
      if (!bundle.verification.stable) throw new Error('continuity export replay verification failed');
      if (!bundle.continuity.events.some(event => event.payload?.checkpointId === target.id)) {
        throw new Error('continuity export should include checkpoint-anchored diagnostic event');
      }

      console.log(JSON.stringify({
        checkpoints: history.checkpoints.length,
        eventDelta,
        anchor: bundle.anchor.id,
        exportChecksum: bundle.exportChecksum,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 3 validation chain', 'npm', ['run', 'validate:phase3']);
