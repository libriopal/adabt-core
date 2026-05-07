import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase8] ${label}`);
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
  console.error('[phase8] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('release evidence persistence smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const { getStorageRepository } = require('./apps/backend/src/storage/repository');
      const {
        collectReleaseReadiness,
        createReleaseEvidenceExport,
        getReleaseEvidenceHistory,
      } = require('./apps/backend/src/diagnostics/releaseReadiness');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');

      initDatabase(':memory:');
      await runReplaySuite();
      await runReplaySuite();

      const ready = await collectReleaseReadiness({
        provider: 'railway',
        includeRollbackPreflight: true,
      });
      if (ready.status !== 'ready') throw new Error('release readiness should be ready');
      if (ready.provider !== 'railway') throw new Error('release provider annotation mismatch');
      if (ready.rollbackPreflight.status !== 'ready') throw new Error('rollback preflight should be ready');

      const repository = getStorageRepository();
      const persisted = await repository.releaseEvidence.getLatest(undefined, 10);
      if (persisted.length === 0) throw new Error('release evidence should persist readiness reports');
      if (persisted[0].provider !== 'railway') throw new Error('persisted provider mismatch');
      if (persisted[0].status !== 'ready') throw new Error('persisted release status mismatch');

      const exported = await createReleaseEvidenceExport({
        provider: 'render',
        includeRollbackPreflight: true,
      });
      if (exported.version !== 'agros-release-evidence-v1') throw new Error('release evidence export version mismatch');
      if (exported.provider !== 'render') throw new Error('export provider annotation mismatch');
      if (!exported.evidenceRecord.id) throw new Error('release export should include persisted evidence id');
      if (!exported.exportChecksum) throw new Error('release export should include checksum');
      if (!exported.degradedReplayExport?.exportChecksum) {
        throw new Error('release export should include rollback degraded replay bundle');
      }

      const history = await getReleaseEvidenceHistory(undefined, 10);
      if (history.length < 2) throw new Error('release evidence history should include persisted reports');

      console.log(JSON.stringify({
        history: history.length,
        provider: exported.provider,
        status: exported.release.status,
        rollbackChecksum: exported.degradedReplayExport.exportChecksum,
        exportChecksum: exported.exportChecksum,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 7 validation chain', 'npm', ['run', 'validate:phase7']);
