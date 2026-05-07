# CHECKPOINT PHASE 8: Release Evidence Capture

## Objective

Phase 8 hardens release auditability by persisting release-readiness reports, tagging them by deployment provider, exporting release evidence JSON, and attaching rollback preflight evidence from degraded replay bundles.

## Implemented

- Added `release_evidence` migrations for SQLite and Postgres.
- Added release evidence persistence to the storage repository.
- Added provider annotations and rollback preflight output to release readiness reports.
- Added release evidence history and export APIs:
  - `GET /api/release/evidence`
  - `GET /api/release/evidence/export`
  - `GET /api/release/evidence/:evidenceId`
- Extended `ReleaseReadinessPanel` with provider selection, JSON export, rollback preflight state, and evidence history.
- Extended release preflight scripts with `--rollback-check=true`.
- Updated release, recovery, deployment, continuity, and README documentation.
- Added `npm run validate:phase8`.

## Runtime Behavior

- Each persisted readiness report records provider, stream, status, gate counts, latest monitor/alert snapshots, rollback preflight status, degraded export checksum, and full report JSON.
- Release evidence export returns a checksum-bearing `agros-release-evidence-v1` bundle with readiness report, persisted evidence row, history, and degraded replay export when rollback preflight is available.
- Provider preflight commands can require rollback evidence by passing `--rollback-check=true`.

## Validation

Commands:

```bash
npm run validate:phase8
timeout 8s npm run dev
```

Expected checks:

- Release readiness persists provider-tagged evidence records.
- Evidence export includes persisted history, export checksum, and degraded replay rollback bundle checksum.
- Phase 7 validation chain remains stable.
- Normal local startup remains ready.

## Rollback Strategy

Revert the release evidence migration, repository methods, release evidence API routes, frontend export controls, preflight rollback flag, Phase 8 docs, and validation script. Phase 7 release readiness gates remain independently usable.

## Next Recommended Phase

Phase 9 should advance automatically after validation and harden production operator handoff:

- Add immutable release decision records for go/no-go outcomes.
- Add signed release evidence checksum comparison across providers.
- Add dashboard filters for provider, release status, and rollback readiness.
- Add CI artifact generation for release evidence bundles.
