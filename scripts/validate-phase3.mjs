import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase3] ${label}`);
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
  console.error('[phase3] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('sqlite replay event history smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase, getDB } = require('./apps/backend/src/storage/db');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');
      const { getReplayHistory, verifyReplayHistory } = require('./apps/backend/src/diagnostics/replayHistory');

      initDatabase(':memory:');
      const replay = await runReplaySuite();
      if (!replay.stable) throw new Error('replay suite should be stable');
      if (!replay.persistence?.checkpoint) throw new Error('replay checkpoint missing');
      if (replay.persistence.appendedEvents.length !== replay.checks.length) {
        throw new Error('replay event count should match check count');
      }

      const history = await getReplayHistory(undefined, 10);
      if (!history.verification.stable) throw new Error('stored replay history should verify');
      if (history.events.length !== replay.checks.length) throw new Error('stored events missing');
      if (history.checkpoints[0]?.id !== replay.persistence.checkpoint.id) {
        throw new Error('latest checkpoint mismatch');
      }

      getDB().prepare('UPDATE event_log SET replay_checksum = ? WHERE sequence = 1').run('tampered');
      const tampered = await verifyReplayHistory();
      if (tampered.stable) throw new Error('tampered replay history should fail verification');
      if (!tampered.failures.some(failure => failure.includes('checksum mismatch'))) {
        throw new Error('tamper failure should report checksum mismatch');
      }

      console.log(JSON.stringify({
        events: history.events.length,
        checkpoint: history.checkpoints[0].id,
        tamperFailures: tampered.failures.length,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 2 validation chain', 'npm', ['run', 'validate:phase2']);
