# CHECKPOINT PHASE 3: Replay Event History

## Objective

Phase 3 makes deterministic replay auditable by storing replay events and checkpoints behind the async repository interface.

## Implemented

- Added append-only `event_log` storage for replay events.
- Added persisted `replay_checkpoints` for replay-suite snapshots.
- Added SQLite and Postgres migrations for replay event history.
- Extended `StorageRepository` with event log and replay checkpoint repositories.
- Added deterministic stored-history verification that recomputes event checksums.
- Persisted replay-suite checks through the replay history layer.
- Exposed `GET /api/replay/history` for stored events, checkpoints, and verification status.
- Included stored replay history status in system diagnostics.
- Added `npm run validate:phase3`.

## Runtime Behavior

- `GET /api/replay/verify` still runs the deterministic replay suite and now appends replay events plus a checkpoint.
- `GET /api/replay/history` returns the stored replay stream, recent checkpoints, and a verification report.
- Stored replay verification fails if an event checksum, sequence, or latest checkpoint is inconsistent.

## Validation

Commands:

```bash
npm run validate:phase3
timeout 8s npm run dev
```

Expected checks:

- Replay-suite events are appended to SQLite storage.
- Replay checkpoints persist through the repository interface.
- Stored replay history verifies against deterministic checksums.
- Tampered replay events fail deterministic history verification.
- Phase 2 validation chain remains stable.
- Normal local startup remains ready with Phase 3 migrations applied.

## Rollback Strategy

Revert the replay history diagnostics module, event/checkpoint repository methods, replay history API route, Phase 3 migrations, and validation script. Phase 2 repository storage remains independently usable.

## Next Recommended Phase

Phase 4 should advance automatically after validation and harden operational replay usage:

- Add operator-facing replay history filtering in the frontend.
- Add checkpoint comparison views for degraded replay runs.
- Add continuity event export anchored to replay checkpoints.
- Add production runbook steps for replay-history recovery.
