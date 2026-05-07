# CHECKPOINT PHASE 5: Replay Recovery Actions

## Objective

Phase 5 hardens replay recovery by separating verification from persistence, adding server-side checkpoint diffs, and exposing replay-history degradation monitoring.

## Implemented

- Added recovery-mode replay verification with `GET /api/replay/verify?persist=false`.
- Added server-side checkpoint diff output through `GET /api/replay/checkpoints/diff`.
- Added replay-history monitoring through `GET /api/replay/monitor`.
- Included replay monitor status in system diagnostics.
- Added export download support in the frontend replay recovery panel.
- Updated the frontend panel for recovery verify, append replay, server diff, monitor alerts, export, and download workflows.
- Updated continuity and recovery docs for monitor and diff recovery steps.
- Added `npm run validate:phase5`.

## Runtime Behavior

- `GET /api/replay/verify` still appends replay events and checkpoints by default.
- `GET /api/replay/verify?persist=false` verifies replay without appending events or checkpoints.
- `GET /api/replay/checkpoints/diff?baseId=<base>&targetId=<target>` returns event delta, checksum changes, check deltas, and degraded checks.
- `GET /api/replay/monitor` returns ready/degraded replay-history status with actionable alerts.
- The frontend can download the selected continuity export as a JSON recovery artifact.

## Validation

Commands:

```bash
npm run validate:phase5
timeout 8s npm run dev
```

Expected checks:

- Recovery-mode replay verification does not append stored replay events.
- Server-side checkpoint diff reports event-count advancement and check deltas.
- Replay monitor reports ready when stored replay history is stable.
- Continuity export remains anchored to the selected checkpoint.
- Phase 4 validation chain remains stable.
- Normal local startup remains ready.

## Rollback Strategy

Revert the recovery-mode replay option, checkpoint diff API, replay monitor API/diagnostics, frontend download/diff/monitor controls, Phase 5 docs, and validation script. Phase 4 replay operations and continuity export anchoring remain independently usable.

## Next Recommended Phase

Phase 6 should advance automatically after validation and harden production replay observability:

- Persist replay monitor snapshots for trend analysis.
- Add frontend monitor history and alert acknowledgement.
- Add degraded replay export bundles with recovery recommendations.
- Add deployment-specific monitoring guidance for Railway, Render, and local Docker.
