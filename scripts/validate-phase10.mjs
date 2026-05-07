import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase10] ${label}`);
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
  console.error('[phase10] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('release closure smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const {
        applyReleaseEvidenceRetention,
        collectPostReleaseDrift,
        createReleaseBundleSummary,
        createReleaseEvidenceExport,
        getReleaseEvidenceHistory,
        getReleaseReconciliationHistory,
        reconcileReleaseDecision,
        recordReleaseDecision,
      } = require('./apps/backend/src/diagnostics/releaseReadiness');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');

      initDatabase(':memory:');
      await runReplaySuite();
      await runReplaySuite();

      await createReleaseEvidenceExport({ provider: 'railway', includeRollbackPreflight: true });
      await createReleaseEvidenceExport({ provider: 'railway', includeRollbackPreflight: true });

      const evidence = await getReleaseEvidenceHistory('agros-replay-suite', 10, {
        provider: 'railway',
        status: 'ready',
        rollbackStatus: 'ready',
      });
      if (evidence.length < 1) throw new Error('phase10 expected ready railway release evidence');

      const decision = await recordReleaseDecision({
        evidenceId: evidence[0].id,
        decision: 'go',
        reason: 'phase10 smoke accepted release evidence',
        decidedBy: 'phase10-smoke',
      });
      if (!decision.decisionSignature) throw new Error('decision signature missing');

      const reconciliation = await reconcileReleaseDecision({
        decisionId: decision.id,
        commitSha: 'phase10-smoke-commit',
        branch: 'coderabbit/slack/agros-phase-stabilization',
        pullRequestUrl: 'https://github.com/libriopal/v0-adaptive-generative-research-os/pull/2',
        sourceThread: 'https://slack.com/app_redirect?channel=D0B26DU6M2N&cid=D0B26DU6M2N&message_ts=1778139351.207119',
        initiatedBy: 'phase10-smoke',
      });
      if (!reconciliation.reconciliationSignature) throw new Error('reconciliation signature missing');

      const reconciliations = await getReleaseReconciliationHistory('agros-replay-suite', 10, {
        decisionId: decision.id,
      });
      if (reconciliations.length !== 1) throw new Error('reconciliation history filter mismatch');

      const bundle = await createReleaseBundleSummary({ decisionId: decision.id, limit: 4 });
      if (bundle.version !== 'agros-release-bundle-summary-v1') throw new Error('bundle version mismatch');
      if (!bundle.reconciliation) throw new Error('bundle should include reconciliation metadata');
      if (!bundle.bundleChecksum) throw new Error('bundle checksum missing');

      const drift = await collectPostReleaseDrift(decision.id);
      if (drift.decisionSignature !== decision.decisionSignature) throw new Error('drift signature mismatch');
      if (!drift.driftChecksum) throw new Error('drift checksum missing');

      const retention = await applyReleaseEvidenceRetention({
        stream: 'agros-replay-suite',
        provider: 'railway',
        retainLatest: 1,
        dryRun: true,
      });
      if (!retention.dryRun) throw new Error('retention smoke must be dry-run');
      if (!retention.retentionChecksum) throw new Error('retention checksum missing');

      console.log(JSON.stringify({
        decision: decision.id,
        reconciliation: reconciliation.id,
        bundle: bundle.bundleChecksum,
        drift: drift.status,
        retentionCandidates: retention.candidateCount,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 9 validation chain', 'npm', ['run', 'validate:phase9']);
