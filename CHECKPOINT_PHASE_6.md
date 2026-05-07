# CHECKPOINT PHASE 6: Replay Observability Persistence

## Objective

Phase 6 hardens production replay observability by persisting replay monitor snapshots, exposing monitor trend and alert acknowledgement flows, and packaging degraded replay evidence with recovery recommendations.

## Implemented

- Added `replay_monitor_snapshots` migrations for SQLite and Postgres.
- Added repository support for saving, listing, and acknowledging replay monitor snapshots.
- Updated replay monitoring to persist snapshots by default and return `snapshotId`.
- Added monitor history and acknowledgement APIs:
  - `GET /api/replay/monitor/history`
  - `POST /api/replay/monitor/:snapshotId/ack`
- Added degraded replay export bundles through `GET /api/replay/degraded-export`.
- Extended `ReplayOperationsPanel` with monitor trend, alert acknowledgement, degraded export generation, and degraded bundle download.
- Updated recovery and continuity docs with Railway, Render, and local Docker monitoring guidance.
- Added `npm run validate:phase6`.

## Runtime Behavior

- `GET /api/replay/monitor` persists a monitor snapshot by default.
- `GET /api/replay/monitor?persist=false` returns monitor status without persisting a snapshot.
- `GET /api/replay/monitor/history?stream=<stream>&limit=<n>` returns persisted monitor snapshots ordered newest first.
- `POST /api/replay/monitor/<snapshotId>/ack` records acknowledgement metadata for accepted alerts.
- `GET /api/replay/degraded-export` returns monitor state, monitor snapshot evidence, continuity export data, recovery recommendations, and an export checksum.

## Validation

Commands:

```bash
npm run validate:phase6
timeout 8s npm run dev
```

Expected checks:

- Replay monitor persistence returns a snapshot ID.
- Monitor history returns persisted snapshots.
- Alert acknowledgement records operator metadata.
- Degraded replay export anchors to a monitor snapshot and includes recovery recommendations.
- Phase 5 validation chain remains stable.
- Normal local startup remains ready.

## Rollback Strategy

Revert the monitor snapshot repository methods, Phase 6 migrations, degraded export API, frontend monitor-history controls, Phase 6 docs, and validation script. Phase 5 replay monitor, checkpoint diff, recovery verify, and continuity export behavior remain independently usable.

## Next Recommended Phase

Phase 7 should advance automatically after validation and harden controlled release operations:

- Add a release-readiness endpoint that combines runtime readiness, replay monitor status, and latest acknowledged alert state.
- Add frontend release gate indicators for ready, degraded, and blocked states.
- Add deployment preflight scripts for Railway, Render, and Docker.
- Add operator runbook steps for release go/no-go decisions.
