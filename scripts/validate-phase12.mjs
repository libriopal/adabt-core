import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase12] ${label}`);
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
  console.error('[phase12] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('managed promotion smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const {
        attachReleasePromotionCiCheck,
        createReleaseEvidenceExport,
        exportReleasePromotionTimeline,
        getReleaseDeploymentCommandDescriptors,
        getReleaseEvidenceHistory,
        recordReleaseDecision,
        reconcileReleaseDecision,
        startReleasePromotion,
        transitionReleasePromotion,
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
      if (!evidence[0]) throw new Error('phase12 expected railway release evidence');

      const decision = await recordReleaseDecision({
        evidenceId: evidence[0].id,
        decision: 'go',
        reason: 'phase12 smoke accepted release evidence',
        decidedBy: 'phase12-smoke',
      });
      await reconcileReleaseDecision({
        decisionId: decision.id,
        commitSha: 'phase12-smoke-commit',
        branch: 'coderabbit/slack/agros-phase-stabilization',
        pullRequestUrl: 'https://github.com/libriopal/v0-adaptive-generative-research-os/pull/2',
        sourceThread: 'https://slack.com/app_redirect?channel=D0B26DU6M2N&cid=D0B26DU6M2N&message_ts=1778139351.207119',
        initiatedBy: 'phase12-smoke',
      });

      const commands = getReleaseDeploymentCommandDescriptors('staging');
      const command = commands.find(item => item.id === 'publish_staging_bundle');
      if (!command) throw new Error('staging deployment command missing');
      if (!command.requiredEnvironmentVariables.includes('AGROS_RELEASE_DECISION_ID')) {
        throw new Error('staging command should declare decision id env guard');
      }

      const started = await startReleasePromotion({
        decisionId: decision.id,
        environment: 'staging',
        commandId: command.id,
        actor: 'phase12-smoke',
      });
      if (started.status !== 'started') throw new Error('promotion should start in started state');
      if (!started.timeline.find(event => event.type === 'promotion_started')) {
        throw new Error('promotion start timeline event missing');
      }

      const approved = await transitionReleasePromotion({
        promotionId: started.id,
        status: 'approved',
        actor: 'phase12-smoke',
        detail: 'phase12 smoke approval',
      });
      if (approved.status !== 'approved' || !approved.approvedAt) {
        throw new Error('promotion approval transition failed');
      }

      const ciAttached = await attachReleasePromotionCiCheck({
        promotionId: approved.id,
        name: 'phase12-ci',
        status: 'passed',
        url: 'https://github.com/libriopal/v0-adaptive-generative-research-os/actions',
        detail: 'phase12 smoke CI passed',
      });
      if (ciAttached.ciChecks.length !== 1) throw new Error('CI check attachment failed');

      const deployed = await transitionReleasePromotion({
        promotionId: ciAttached.id,
        status: 'deployed',
        actor: 'phase12-smoke',
        detail: 'phase12 smoke deployment completed',
        outcome: 'succeeded',
      });
      if (deployed.status !== 'deployed' || deployed.outcome !== 'succeeded') {
        throw new Error('promotion deploy transition failed');
      }

      const timeline = await exportReleasePromotionTimeline(deployed.id);
      if (timeline.version !== 'agros-release-promotion-timeline-v1') throw new Error('timeline export version mismatch');
      if (!timeline.exportChecksum) throw new Error('timeline export checksum missing');
      if (timeline.timeline.length < 4) throw new Error('timeline should include promotion and CI events');
      if (timeline.ciChecks[0].status !== 'passed') throw new Error('timeline should include CI check state');

      console.log(JSON.stringify({
        promotion: deployed.id,
        status: deployed.status,
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

run('phase 11 validation chain', 'npm', ['run', 'validate:phase11']);
