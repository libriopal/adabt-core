import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase9] ${label}`);
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
  console.error('[phase9] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('release decision and checksum smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const {
        compareReleaseEvidenceByProvider,
        createReleaseEvidenceExport,
        getReleaseDecisionHistory,
        getReleaseEvidenceHistory,
        recordReleaseDecision,
      } = require('./apps/backend/src/diagnostics/releaseReadiness');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');

      initDatabase(':memory:');
      await runReplaySuite();
      await runReplaySuite();

      await createReleaseEvidenceExport({ provider: 'railway', includeRollbackPreflight: true });
      await createReleaseEvidenceExport({ provider: 'render', includeRollbackPreflight: true });

      const comparison = await compareReleaseEvidenceByProvider('agros-replay-suite', ['railway', 'render']);
      if (!comparison.allMatched) throw new Error('provider evidence checksums should match');
      if (!comparison.records.every(record => record.providerSignature)) {
        throw new Error('provider comparison should include signatures');
      }

      const filtered = await getReleaseEvidenceHistory('agros-replay-suite', 10, {
        provider: 'railway',
        status: 'ready',
        rollbackStatus: 'ready',
      });
      if (filtered.length !== 1) throw new Error('release evidence filters should isolate railway ready record');

      const decision = await recordReleaseDecision({
        evidenceId: filtered[0].id,
        decision: 'go',
        reason: 'phase9 smoke accepted release evidence',
        decidedBy: 'phase9-smoke',
      });
      if (!decision.decisionSignature) throw new Error('release decision should include immutable signature');

      const decisions = await getReleaseDecisionHistory('agros-replay-suite', 10, {
        provider: 'railway',
        decision: 'go',
      });
      if (decisions.length !== 1) throw new Error('release decision history filter mismatch');

      console.log(JSON.stringify({
        comparison: comparison.allMatched,
        evidence: filtered[0].id,
        decision: decision.id,
        providerSignature: comparison.records[0].providerSignature,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 8 validation chain', 'npm', ['run', 'validate:phase8']);
