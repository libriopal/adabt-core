# CHECKPOINT PHASE 4: Replay Operations

## Objective

Phase 4 makes replay history operationally inspectable and exportable for recovery work.

## Implemented

- Added `GET /api/continuity/export` for replay-checkpoint-anchored continuity exports.
- Added a continuity export bundle with replay history, verification state, recent continuity events, and export checksum.
- Added `ReplayOperationsPanel` for operator-facing replay history filtering.
- Added checkpoint comparison controls for stored replay checkpoints.
- Added continuity export controls anchored to the selected replay checkpoint.
- Updated the architecture manifest with replay history and continuity export components.
- Updated recovery and continuity runbooks for replay-history recovery.
- Added `npm run validate:phase4`.

## Runtime Behavior

- `GET /api/replay/history?stream=agros-replay-suite&limit=20` filters stored replay events and checkpoints.
- `GET /api/continuity/export?checkpointId=<checkpoint>` exports a continuity bundle anchored to a replay checkpoint.
- The frontend Phase 4 panel can run replay verification, refresh filtered history, compare checkpoint deltas, and request an export anchor.

## Validation

Commands:

```bash
npm run validate:phase4
timeout 8s npm run dev
```

Expected checks:

- Replay history has at least two checkpoints after repeated replay verification.
- Latest checkpoint advances the stored replay event count.
- Continuity export anchors to the selected replay checkpoint.
- Continuity export includes checkpoint-linked diagnostic events.
- Phase 3 validation chain remains stable.
- Normal local startup remains ready.

## Rollback Strategy

Revert the continuity export module and route, the replay operations frontend panel, Phase 4 manifest/doc updates, and the Phase 4 validation script. Phase 3 replay history persistence remains independently usable.

## Next Recommended Phase

Phase 5 should advance automatically after validation and harden replay recovery actions:

- Add server-side checkpoint diff output for API consumers.
- Add recovery-mode replay verification that can run without appending new events.
- Add export download support in the frontend.
- Add production monitoring checks for replay-history degradation.
