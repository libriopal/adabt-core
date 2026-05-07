import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase13] ${label}`);
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
  console.error('[phase13] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('rollback supervision smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const {
        attachReleasePromotionCiCheck,
        attachReleaseRollbackCiCheck,
        createReleaseEvidenceExport,
        exportReleaseRollbackTimeline,
        getReleaseEvidenceHistory,
        getReleaseRollbackCommandDescriptors,
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
      if (!evidence[0]) throw new Error('phase13 expected railway release evidence');

      const decision = await recordReleaseDecision({
        evidenceId: evidence[0].id,
        decision: 'go',
        reason: 'phase13 smoke accepted release evidence',
        decidedBy: 'phase13-smoke',
      });
      await reconcileReleaseDecision({
        decisionId: decision.id,
        commitSha: 'phase13-smoke-commit',
        branch: 'coderabbit/slack/agros-phase-stabilization',
        pullRequestUrl: 'https://github.com/libriopal/v0-adaptive-generative-research-os/pull/2',
        sourceThread: 'https://slack.com/app_redirect?channel=D0B26DU6M2N&cid=D0B26DU6M2N&message_ts=1778139351.207119',
        initiatedBy: 'phase13-smoke',
      });

      const promotion = await startReleasePromotion({
        decisionId: decision.id,
        environment: 'staging',
        commandId: 'publish_staging_bundle',
        actor: 'phase13-smoke',
      });
      const ciAttached = await attachReleasePromotionCiCheck({
        promotionId: promotion.id,
        name: 'phase13-promotion-ci',
        status: 'failed',
        detail: 'phase13 smoke promotion CI failed',
      });
      const failedPromotion = await transitionReleasePromotion({
        promotionId: ciAttached.id,
        status: 'failed',
        actor: 'phase13-smoke',
        detail: 'phase13 smoke promotion failed',
        outcome: 'failed',
      });

      const commands = getReleaseRollbackCommandDescriptors('staging');
      const command = commands.find(item => item.id === 'rehearse_staging_rollback');
      if (!command) throw new Error('staging rollback command missing');
      if (!command.requiredEnvironmentVariables.includes('AGROS_RELEASE_PROMOTION_ID')) {
        throw new Error('rollback command should declare promotion id env guard');
      }

      const planned = await planReleaseRollback({
        promotionId: failedPromotion.id,
        environment: 'staging',
        commandId: command.id,
        actor: 'phase13-smoke',
      });
      if (planned.status !== 'planned') throw new Error('rollback should start planned');
      if (!planned.timeline.find(event => event.type === 'rollback_planned')) {
        throw new Error('rollback planned timeline event missing');
      }

      const approved = await transitionReleaseRollback({
        rollbackId: planned.id,
        status: 'approved',
        actor: 'phase13-smoke',
        detail: 'phase13 smoke rollback approval',
      });
      if (approved.status !== 'approved' || !approved.approvedAt) {
        throw new Error('rollback approval transition failed');
      }

      const rollbackCi = await attachReleaseRollbackCiCheck({
        rollbackId: approved.id,
        name: 'phase13-rollback-ci',
        status: 'passed',
        detail: 'phase13 smoke rollback CI passed',
      });
      if (rollbackCi.ciChecks.length !== 1) throw new Error('rollback CI check attachment failed');

      const rehearsed = await transitionReleaseRollback({
        rollbackId: rollbackCi.id,
        status: 'rehearsed',
        actor: 'phase13-smoke',
        detail: 'phase13 smoke rollback rehearsal completed',
      });
      const executed = await transitionReleaseRollback({
        rollbackId: rehearsed.id,
        status: 'executed',
        actor: 'phase13-smoke',
        detail: 'phase13 smoke rollback executed',
        outcome: 'succeeded',
      });
      if (executed.status !== 'executed' || executed.outcome !== 'succeeded') {
        throw new Error('rollback execute transition failed');
      }

      const timeline = await exportReleaseRollbackTimeline(executed.id);
      if (timeline.version !== 'agros-release-rollback-timeline-v1') throw new Error('rollback timeline version mismatch');
      if (!timeline.exportChecksum) throw new Error('rollback timeline checksum missing');
      if (timeline.promotionTimeline.promotion.status !== 'failed') throw new Error('rollback timeline should link failed promotion');
      if (timeline.timeline.length < 5) throw new Error('rollback timeline should include plan, approval, CI, rehearsal, and execution');

      console.log(JSON.stringify({
        rollback: executed.id,
        status: executed.status,
        timelineEvents: timeline.timeline.length,
        ciChecks: timeline.ciChecks.length,
        exportChecksum: timeline.exportChecksum,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 12 validation chain', 'npm', ['run', 'validate:phase12']);
