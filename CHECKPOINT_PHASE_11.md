# CHECKPOINT PHASE 11: Release Supervision

## Status

Phase 11 advances automated release supervision by generating environment-owned release status cards, exposing drift exception override actions, publishing CI bundle summary artifacts, and applying retention policy presets for local, staging, and production evidence archives.

## Completed

- Added drift override archive persistence:
  - `POST /api/release/drift-overrides`
  - `GET /api/release/drift-overrides`
- Added release supervision APIs:
  - `GET /api/release/supervision-card`
  - `GET /api/release/evidence/retention/presets`
- Added `agros-release-supervision-card-v1` status cards with environment, decision, bundle, drift, retention, action, and checksum metadata.
- Added retention presets for local, staging, and production environments.
- Added `npm run artifact:release-bundle` for CI-driven release bundle publication.
- Updated `deploy/github-actions-ci.yml` to upload bundle summary artifacts when `AGROS_RELEASE_DECISION_ID` is configured.
- Extended `ReleaseReadinessPanel` with release environment, supervision card, retention preset, and drift override controls.
- Updated the architecture manifest and operator documentation.
- Added `npm run validate:phase11`.

## Guarantees

- Drift overrides are append-only and signed against the accepted decision signature plus the current drift checksum.
- Supervision cards are deterministic, checksum-bearing status payloads that can be rendered by operator tools or Slack automation surfaces.
- Retention presets default to dry-run behavior, including production.
- CI bundle publication is opt-in and requires an explicit release decision ID.

## Validation

Run:

```bash
npm run validate:phase11
```

The Phase 11 validator creates release evidence, records and reconciles a decision, verifies retention presets, generates a supervision card, records a drift override, refreshes the card with override state, and chains Phase 10 validation.

## Rollback Notes

Revert the drift override migration, repository methods, supervision card diagnostics, supervision and override routes, bundle publication script, CI template updates, dashboard controls, Phase 11 docs, manifest updates, and validation script. Phase 10 release closure remains independently usable.

## Next Phase Recommendation

Phase 12 should advance managed promotion automation:

- Add promotion window run records with start, stop, approval, and outcome state.
- Add environment-specific deployment command descriptors guarded by release supervision cards.
- Add CI monitor hooks that attach check results to the release supervision card.
- Add promotion timeline export for incident and audit handoff.
