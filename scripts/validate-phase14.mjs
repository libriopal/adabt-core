import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const tsx = resolve(root, 'apps/backend/node_modules/.bin/tsx');

function run(label, command, args, env = {}) {
  console.log(`\n[phase14] ${label}`);
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
  console.error('[phase14] missing apps/backend tsx binary; run npm install');
  process.exit(1);
}

run('release artifact integrity smoke', tsx, [
  '-e',
  `
    (async () => {
      const { initDatabase } = require('./apps/backend/src/storage/db');
      const {
        attachReleasePromotionCiCheck,
        attachReleaseRollbackCiCheck,
        createReleaseBundleSummary,
        createReleaseEvidenceBundleManifest,
        createReleaseEvidenceExport,
        exportReleasePromotionTimeline,
        exportReleaseRollbackTimeline,
        getReleaseEvidenceHistory,
        planReleaseRollback,
        recordReleaseDecision,
        reconcileReleaseDecision,
        startReleasePromotion,
        transitionReleasePromotion,
        transitionReleaseRollback,
        verifyReleaseHandoffArtifacts,
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
      if (!evidence[0]) throw new Error('phase14 expected railway release evidence');

      const decision = await recordReleaseDecision({
        evidenceId: evidence[0].id,
        decision: 'go',
        reason: 'phase14 smoke accepted release evidence',
        decidedBy: 'phase14-smoke',
      });
      await reconcileReleaseDecision({
        decisionId: decision.id,
        commitSha: 'phase14-smoke-commit',
        branch: 'coderabbit/slack/agros-phase-stabilization',
        pullRequestUrl: 'https://github.com/libriopal/v0-adaptive-generative-research-os/pull/2',
        sourceThread: 'https://slack.com/app_redirect?channel=D0B26DU6M2N&cid=D0B26DU6M2N&message_ts=1778139351.207119',
        initiatedBy: 'phase14-smoke',
      });

      const promotion = await startReleasePromotion({
        decisionId: decision.id,
        environment: 'staging',
        commandId: 'publish_staging_bundle',
        actor: 'phase14-smoke',
      });
      await attachReleasePromotionCiCheck({
        promotionId: promotion.id,
        name: 'phase14-promotion-ci',
        status: 'failed',
        detail: 'phase14 smoke promotion CI failed',
      });
      const failedPromotion = await transitionReleasePromotion({
        promotionId: promotion.id,
        status: 'failed',
        actor: 'phase14-smoke',
        detail: 'phase14 smoke promotion failed',
        outcome: 'failed',
      });
      const planned = await planReleaseRollback({
        promotionId: failedPromotion.id,
        environment: 'staging',
        commandId: 'rehearse_staging_rollback',
        actor: 'phase14-smoke',
      });
      const approved = await transitionReleaseRollback({
        rollbackId: planned.id,
        status: 'approved',
        actor: 'phase14-smoke',
        detail: 'phase14 smoke rollback approved',
      });
      await attachReleaseRollbackCiCheck({
        rollbackId: approved.id,
        name: 'phase14-rollback-ci',
        status: 'passed',
        detail: 'phase14 smoke rollback CI passed',
      });
      const executed = await transitionReleaseRollback({
        rollbackId: approved.id,
        status: 'executed',
        actor: 'phase14-smoke',
        detail: 'phase14 smoke rollback executed',
        outcome: 'succeeded',
      });

      const bundle = await createReleaseBundleSummary({ decisionId: decision.id, limit: 4 });
      const promotionTimeline = await exportReleasePromotionTimeline(failedPromotion.id);
      const rollbackTimeline = await exportReleaseRollbackTimeline(executed.id);
      const manifest = await createReleaseEvidenceBundleManifest({
        decisionId: decision.id,
        promotionId: failedPromotion.id,
        rollbackId: executed.id,
        limit: 4,
      });
      if (manifest.version !== 'agros-release-evidence-manifest-v1') throw new Error('manifest version mismatch');
      if (manifest.triage.status !== 'ready') throw new Error('manifest should cover every handoff artifact');
      if (manifest.artifacts.length !== 4) throw new Error('manifest should cover release, bundle, promotion, and rollback artifacts');
      if (!manifest.manifestSignature) throw new Error('manifest signature missing');

      const verification = verifyReleaseHandoffArtifacts({
        manifest,
        artifacts: {
          release_evidence: bundle.evidence,
          release_bundle_summary: bundle,
          promotion_timeline: promotionTimeline,
          rollback_timeline: rollbackTimeline,
        },
      });
      if (verification.status !== 'ready') throw new Error(\`artifact verification should be ready: \${verification.mismatches.join('; ')}\`);

      const mismatched = verifyReleaseHandoffArtifacts({
        manifest,
        artifacts: {
          release_evidence: bundle.evidence,
          release_bundle_summary: { ...bundle, summary: { ...bundle.summary, releaseReady: !bundle.summary.releaseReady } },
          promotion_timeline: promotionTimeline,
          rollback_timeline: rollbackTimeline,
        },
      });
      if (mismatched.status !== 'blocked') throw new Error('tampered bundle should block verification');

      console.log(JSON.stringify({
        manifest: manifest.manifestChecksum,
        artifacts: manifest.artifacts.length,
        verification: verification.status,
        mismatchStatus: mismatched.status,
      }));
    })().catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `,
]);

run('phase 13 validation chain', 'npm', ['run', 'validate:phase13']);
