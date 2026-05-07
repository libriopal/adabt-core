import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase11] ${label}`);
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
  console.error('[phase11] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('release supervision smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const {
        applyReleaseEvidenceRetention,
        collectPostReleaseDrift,
        createReleaseEvidenceExport,
        createReleaseSupervisionStatusCard,
        getReleaseDriftOverrideHistory,
        getReleaseEvidenceHistory,
        getReleaseRetentionPolicyPresets,
        recordReleaseDecision,
        recordReleaseDriftOverride,
        reconcileReleaseDecision,
      } = require('./apps/backend/src/diagnostics/releaseReadiness');
      const { runReplaySuite } = require('./apps/backend/src/diagnostics/replaySuite');

      initDatabase(':memory:');
      await runReplaySuite();
      await runReplaySuite();

      await createReleaseEvidenceExport({ provider: 'railway', includeRollbackPreflight: true });
      const evidence = await getReleaseEvidenceHistory('agros-replay-suite', 10, {
        provider: 'railway',
        status: 'ready',
        rollbackStatus: 'ready',
      });
      if (!evidence[0]) throw new Error('phase11 expected railway release evidence');

      const decision = await recordReleaseDecision({
        evidenceId: evidence[0].id,
        decision: 'go',
        reason: 'phase11 smoke accepted release evidence',
        decidedBy: 'phase11-smoke',
      });
      await reconcileReleaseDecision({
        decisionId: decision.id,
        commitSha: 'phase11-smoke-commit',
        branch: 'coderabbit/slack/agros-phase-stabilization',
        pullRequestUrl: 'https://github.com/libriopal/v0-adaptive-generative-research-os/pull/2',
        sourceThread: 'https://slack.com/app_redirect?channel=D0B26DU6M2N&cid=D0B26DU6M2N&message_ts=1778139351.207119',
        initiatedBy: 'phase11-smoke',
      });

      const presets = getReleaseRetentionPolicyPresets();
      if (!presets.find(preset => preset.name === 'production' && preset.retainLatest > 100)) {
        throw new Error('production retention preset missing');
      }
      const retention = await applyReleaseEvidenceRetention({
        stream: 'agros-replay-suite',
        provider: 'railway',
        environment: 'production',
        policy: 'production',
        dryRun: true,
      });
      if (retention.retainLatest !== 250) throw new Error('production retention preset mismatch');

      const card = await createReleaseSupervisionStatusCard({
        decisionId: decision.id,
        environment: 'staging',
        policy: 'staging',
      });
      if (card.version !== 'agros-release-supervision-card-v1') throw new Error('supervision card version mismatch');
      if (!card.actions.find(action => action.actionId === 'record_drift_exception')) {
        throw new Error('supervision card should expose drift exception action');
      }
      if (!card.cardChecksum) throw new Error('supervision card checksum missing');

      const drift = await collectPostReleaseDrift(decision.id);
      const override = await recordReleaseDriftOverride({
        decisionId: decision.id,
        environment: 'staging',
        driftChecksum: drift.driftChecksum,
        reason: 'phase11 smoke operator override',
        overriddenBy: 'phase11-smoke',
      });
      if (!override.overrideSignature) throw new Error('override signature missing');

      const overrides = await getReleaseDriftOverrideHistory('agros-replay-suite', 10, {
        decisionId: decision.id,
        environment: 'staging',
      });
      if (overrides.length !== 1) throw new Error('override history filter mismatch');

      const supervised = await createReleaseSupervisionStatusCard({
        decisionId: decision.id,
        environment: 'staging',
      });
      if (!supervised.latestOverride) throw new Error('supervision card should include latest override');

      console.log(JSON.stringify({
        decision: decision.id,
        card: supervised.cardChecksum,
        override: override.id,
        retentionPolicy: retention.retainLatest,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 10 validation chain', 'npm', ['run', 'validate:phase10']);
