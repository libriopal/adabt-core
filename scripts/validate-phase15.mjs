import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase15] ${label}`);
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
  console.error('[phase15] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('release incident packet smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const {
        attachReleasePromotionCiCheck,
        attachReleaseRollbackCiCheck,
        createReleaseIncidentPacket,
        createReleaseEvidenceExport,
        getReleaseEvidenceHistory,
        planReleaseRollback,
        recordReleaseDecision,
        reconcileReleaseDecision,
        startReleasePromotion,
        transitionReleasePromotion,
        transitionReleaseRollback,
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
      if (!evidence[0]) throw new Error('phase15 expected railway release evidence');

      const decision = await recordReleaseDecision({
        evidenceId: evidence[0].id,
        decision: 'go',
        reason: 'phase15 smoke accepted release evidence',
        decidedBy: 'phase15-smoke',
      });
      await reconcileReleaseDecision({
        decisionId: decision.id,
        commitSha: 'phase15-smoke-commit',
        branch: 'coderabbit/slack/agros-phase-stabilization',
        pullRequestUrl: 'https://github.com/libriopal/v0-adaptive-generative-research-os/pull/2',
        sourceThread: 'https://slack.com/app_redirect?channel=D0B26DU6M2N&cid=D0B26DU6M2N&message_ts=1778139351.207119',
        initiatedBy: 'phase15-smoke',
      });

      const promotion = await startReleasePromotion({
        decisionId: decision.id,
        environment: 'staging',
        commandId: 'publish_staging_bundle',
        actor: 'phase15-smoke',
      });
      await attachReleasePromotionCiCheck({
        promotionId: promotion.id,
        name: 'phase15-promotion-ci',
        status: 'failed',
        detail: 'phase15 smoke promotion CI failed',
      });
      const failedPromotion = await transitionReleasePromotion({
        promotionId: promotion.id,
        status: 'failed',
        actor: 'phase15-smoke',
        detail: 'phase15 smoke promotion failed',
        outcome: 'failed',
      });
      const planned = await planReleaseRollback({
        promotionId: failedPromotion.id,
        environment: 'staging',
        commandId: 'rehearse_staging_rollback',
        actor: 'phase15-smoke',
      });
      const approved = await transitionReleaseRollback({
        rollbackId: planned.id,
        status: 'approved',
        actor: 'phase15-smoke',
        detail: 'phase15 smoke rollback approved',
      });
      await attachReleaseRollbackCiCheck({
        rollbackId: approved.id,
        name: 'phase15-rollback-ci',
        status: 'passed',
        detail: 'phase15 smoke rollback CI passed',
      });
      const executed = await transitionReleaseRollback({
        rollbackId: approved.id,
        status: 'executed',
        actor: 'phase15-smoke',
        detail: 'phase15 smoke rollback executed',
        outcome: 'succeeded',
      });

      const privatePacket = await createReleaseIncidentPacket({
        decisionId: decision.id,
        promotionId: failedPromotion.id,
        rollbackId: executed.id,
        owner: 'phase15-owner',
        visibility: 'private',
        limit: 4,
      });
      if (privatePacket.version !== 'agros-release-incident-packet-v1') throw new Error('incident packet version mismatch');
      if (privatePacket.owner !== 'phase15-owner') throw new Error('incident packet owner mismatch');
      if (privatePacket.visibility !== 'private') throw new Error('private incident packet visibility mismatch');
      if (privatePacket.manifest.version !== 'agros-release-evidence-manifest-v1') throw new Error('incident packet manifest missing');
      if (privatePacket.verification.status !== 'ready') throw new Error(\`private packet verification should be ready: \${privatePacket.verification.mismatches.join('; ')}\`);
      if (!privatePacket.rollbackTimeline) throw new Error('private packet rollback timeline missing');
      if (!privatePacket.packetChecksum) throw new Error('incident packet checksum missing');

      const publicPacket = await createReleaseIncidentPacket({
        decisionId: decision.id,
        promotionId: failedPromotion.id,
        rollbackId: executed.id,
        owner: 'phase15-owner',
        visibility: 'public',
        limit: 4,
      });
      if (publicPacket.visibility !== 'public') throw new Error('public incident packet visibility mismatch');
      if (publicPacket.redactions.length === 0) throw new Error('public incident packet should redact private handoff fields');
      const publicBundle = publicPacket.bundleSummary;
      if (publicBundle.reconciliation?.sourceThread || publicBundle.reconciliation?.pullRequestUrl || publicBundle.reconciliation?.initiatedBy) {
        throw new Error('public incident packet leaked private reconciliation fields');
      }

      console.log(JSON.stringify({
        privateStatus: privatePacket.summary.status,
        publicStatus: publicPacket.summary.status,
        redactions: publicPacket.redactions.length,
        packetChecksum: publicPacket.packetChecksum,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 14 validation chain', 'npm', ['run', 'validate:phase14']);
