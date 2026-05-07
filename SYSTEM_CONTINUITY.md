# AGROS System Continuity

## Continuity Goals

AGROS preserves:

- deterministic seed identity
- replay parity across sessions
- checkpoint recovery paths
- architecture manifest continuity
- cocoon reconstruction fidelity
- interrupt/resume operational state

## Continuity Flow

```text
Seed
  -> deterministic PRNG state
  -> generated genome or design state
  -> replay checksum
  -> cocoon serialization
  -> reconstruction verification
  -> recovery checkpoint
```

## Runtime Continuity Interfaces

Backend endpoints:

- `GET /api/replay/verify`: verifies deterministic demand and reinforcement replay.
- `GET /api/replay/verify?persist=false`: verifies replay without appending recovery events.
- `GET /api/replay/history`: returns replay events, replay checkpoints, and stored-history verification.
- `GET /api/replay/monitor`: returns replay-history degradation status and alerts.
- `GET /api/replay/monitor/history`: returns persisted replay monitor snapshots for trend analysis.
- `POST /api/replay/monitor/:snapshotId/ack`: records operator acknowledgement for a monitor alert.
- `GET /api/replay/checkpoints/diff`: returns server-side checkpoint comparisons.
- `GET /api/replay/degraded-export`: exports monitor state, continuity state, and recovery recommendations.
- `GET /api/continuity/export`: exports replay-checkpoint-anchored continuity state for recovery.
- `GET /api/release/readiness`: returns release go/no-go gates for runtime, replay monitor, and alert acknowledgement state.
- `GET /api/release/evidence/export`: persists provider-tagged release readiness evidence with rollback preflight checks.
- `GET /api/release/evidence/compare`: compares signed release evidence checksums across providers.
- `POST /api/release/decisions`: records immutable go/no-go/exception decisions for release evidence.
- `GET /api/diagnostics`: returns runtime, replay, database, continuity, demand, and reinforcement diagnostics.
- `GET /api/continuity/status`: returns websocket clients, interrupted run IDs, and recent continuity events.
- `POST /api/continuity/:runId/interrupt`: pauses a run when possible and broadcasts a continuity interrupt event.
- `POST /api/continuity/:runId/resume`: resumes a paused run when possible and broadcasts a continuity resume event.

Websocket:

- `/ws/continuity`: emits connected, heartbeat, interrupt, resume, and diagnostic events.

## Multi-Session Compatibility

Frontend continuity is preserved through:

- IndexedDB persistence
- architecture manifests
- deterministic PRNG state capture
- cocoon state serialization
- topology signatures

Backend continuity is preserved through:

- SQLite WAL persistence
- evolution run records
- reinforcement replay checksums
- replay event history and replay checkpoints
- continuity exports anchored to replay checkpoints
- recovery-mode replay verification without persistence
- server-side checkpoint diffs and replay monitor alerts
- persisted replay monitor snapshots and alert acknowledgements
- degraded replay recovery exports with recommendations
- release-readiness gates for controlled go/no-go decisions
- demand cache records
- structured request IDs

## Replay Requirements

A production run is stable only when:

- two identical seeded evolution runs produce the same checksum
- reinforcement replay returns stable
- cocoon reconstruction returns stable
- cocoon replay returns stable
- checkpoint restore returns the same topology checksum
