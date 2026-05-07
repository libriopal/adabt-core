# CHECKPOINT PHASE 9: Production Operator Handoff

## Objective

Phase 9 hardens production operator handoff by recording immutable release decisions, comparing signed release evidence checksums across providers, filtering evidence history for dashboards, and generating CI release evidence artifacts.

## Implemented

- Added `release_decisions` migrations for SQLite and Postgres.
- Added immutable release decision persistence to the storage repository.
- Added signed release evidence checksum comparison across providers.
- Added release decision APIs:
  - `POST /api/release/decisions`
  - `GET /api/release/decisions`
- Added provider checksum comparison API:
  - `GET /api/release/evidence/compare`
- Added provider, release status, and rollback status filters to release evidence history.
- Extended `ReleaseReadinessPanel` with evidence filters, provider checksum comparison, and go/no-go/exception decision capture.
- Added `npm run artifact:release-evidence` for CI release evidence JSON generation.
- Updated the CI template to upload release evidence when `AGROS_API_URL` is configured.
- Added `npm run validate:phase9`.

## Runtime Behavior

- Release decisions are append-only records signed with the normalized evidence checksum, provider signature, and decision signature.
- Provider comparison normalizes evidence payloads before signing, so provider-specific metadata does not hide release-state drift.
- Evidence history can be filtered by provider, release status, and rollback status for operator dashboards.
- CI can generate and upload a release evidence artifact after validation when a deployed backend URL is available.

## Validation

Commands:

```bash
npm run validate:phase9
timeout 8s npm run dev
```

Expected checks:

- Provider evidence checksums match for equivalent Railway and Render readiness exports.
- Evidence filters isolate a provider-specific ready record.
- Release decision capture creates a signed immutable go decision.
- Phase 8 validation chain remains stable.
- Normal local startup remains ready.

## Rollback Strategy

Revert the release decision migration, repository methods, release decision and comparison APIs, dashboard filters, CI artifact script/template updates, Phase 9 docs, and validation script. Phase 8 release evidence export remains independently usable.

## Next Recommended Phase

Phase 10 should advance automatically after validation and harden production closure:

- Add release decision reconciliation against PR/commit metadata.
- Add operator-facing release bundle summary pages.
- Add long-term release evidence retention controls.
- Add post-release monitor drift alerts keyed to the accepted decision signature.
