# CHECKPOINT PHASE 13

## Scope

Phase 13 advances post-promotion rollback automation by adding rollback records linked to failed or degraded promotion timelines, guarded rollback command descriptors, rollback CI evidence hooks, and rollback timeline exports for audit and incident handoff.

## Completed

- Added persistent rollback records for planning, approval, rehearsal, execution, failure, cancellation, CI checks, and timeline events.
- Added rollback APIs:
  - `GET /api/release/rollback-commands`
  - `POST /api/release/rollbacks`
  - `GET /api/release/rollbacks`
  - `POST /api/release/rollbacks/:rollbackId/transition`
  - `POST /api/release/rollbacks/:rollbackId/ci-checks`
  - `GET /api/release/rollbacks/:rollbackId/timeline`
- Added `agros-release-rollback-timeline-v1` exports with rollback state, rollback CI checks, linked promotion timeline evidence, and an export checksum.
- Added `npm run release:rollback-ci-check` and `npm run artifact:rollback-timeline` for CI-driven rollback evidence.
- Updated `deploy/github-actions-ci.yml` to attach rollback CI results and upload rollback timelines when `AGROS_RELEASE_ROLLBACK_ID` is configured.
- Extended `ReleaseReadinessPanel` with rollback command selection, rollback planning, approval, rehearsal, execution, CI attachment, and timeline export.

## Guarantees

- Rollback planning requires a failed promotion, failed promotion outcome, failed promotion CI check, or `promotion_failed` timeline signal.
- Rollback command descriptors declare the promotion timeline guard, required promotion states, required timeline signals, and required CI environment variables.
- Rollback records store the promotion timeline checksum so incident handoff can connect rollback state to the failed promotion evidence.
- Rollback timeline exports carry checksums for rollback events, rollback CI checks, and the linked promotion timeline.

## Validation

```bash
npm run validate:phase13
```

The Phase 13 validator creates release evidence, records and reconciles a go decision, starts a promotion, marks promotion CI failed, records promotion failure, verifies rollback command descriptors, plans a rollback, records approval, attaches rollback CI, records rehearsal and execution, exports the rollback timeline, and chains Phase 12 validation.

## Rollback

Revert the release rollback migration, repository methods, rollback diagnostics, routes, CI scripts, CI template updates, dashboard controls, Phase 13 docs, manifest updates, and validation script. Phase 12 managed promotion remains independently usable.

## Next

Phase 14 should advance release evidence integrity automation:

- Add signed evidence bundle manifests that cover release, promotion, and rollback timelines.
- Add integrity verification routes for uploaded handoff artifacts.
- Add dashboard controls for artifact verification and mismatch triage.
- Add CI scripts that verify exported artifacts before publishing them.
