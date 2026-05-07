# CHECKPOINT PHASE 12

## Scope

Phase 12 advances managed promotion automation by adding promotion window records, deployment command descriptors guarded by release supervision cards, CI monitor evidence hooks, and promotion timeline exports for audit and incident handoff.

## Completed

- Added persistent release promotion records for start, stop, approval, deployment, failure, rejection, CI checks, and timeline events.
- Added release promotion APIs:
  - `GET /api/release/deployment-commands`
  - `POST /api/release/promotions`
  - `GET /api/release/promotions`
  - `POST /api/release/promotions/:promotionId/transition`
  - `POST /api/release/promotions/:promotionId/ci-checks`
  - `GET /api/release/promotions/:promotionId/timeline`
- Added `agros-release-promotion-timeline-v1` exports with promotion state, CI checks, supervision card metadata, and an export checksum.
- Added `npm run release:ci-check` and `npm run artifact:promotion-timeline` for CI-driven promotion evidence.
- Updated `deploy/github-actions-ci.yml` to attach CI results and upload promotion timelines when `AGROS_RELEASE_PROMOTION_ID` is configured.
- Extended `ReleaseReadinessPanel` with guarded deployment command selection, promotion window controls, CI attachment, and timeline export.

## Guarantees

- Promotion starts require a go decision and a supervised release card for the target environment.
- Deployment command descriptors declare the supervision guard, required decision, required card status, and required CI environment variables.
- CI monitor results are attached directly to the promotion timeline before final handoff.
- Timeline exports carry checksums for promotion events, CI checks, and the supervision card state.

## Validation

```bash
npm run validate:phase12
```

The Phase 12 validator creates release evidence, records and reconciles a go decision, verifies staging command descriptors, starts a promotion, records approval, attaches a CI check, records deployment, exports the promotion timeline, and chains Phase 11 validation.

## Rollback

Revert the release promotion migration, repository methods, promotion diagnostics, routes, CI scripts, CI template updates, dashboard controls, Phase 12 docs, manifest updates, and validation script. Phase 11 release supervision remains independently usable.

## Next

Phase 13 should advance post-promotion rollback automation:

- Add rollback command descriptors guarded by failed or degraded promotion timelines.
- Add promotion-to-rollback linkage records with operator approval state.
- Add rollback CI evidence attachment and rollback timeline exports.
- Add dashboard controls for supervised rollback rehearsal and execution.
