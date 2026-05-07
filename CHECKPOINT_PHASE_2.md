# CHECKPOINT PHASE 2: Production Storage Cutover

## Objective

Phase 2 moves request-time persistence behind an async repository interface with both SQLite and Postgres implementations.

## Implemented

- Added `StorageRepository` with async repositories for designs, evolution runs, demand cache, and reinforcement events.
- Added SQLite implementation backed by the existing deterministic `better-sqlite3` runtime.
- Added Postgres implementation backed by `pg.Pool`.
- Updated backend startup to initialize the selected storage provider before listening.
- Routed API request-time storage through the async repository interface.
- Routed generation, demand, reinforcement, and evolution persistence through the async repository interface.
- Updated diagnostics and startup validation to use provider-aware storage checks.
- Added production Postgres guardrails: `DATABASE_PROVIDER=postgres` requires `DATABASE_URL`.
- Added `npm run validate:phase2`.

## Local Defaults

- `DATABASE_PROVIDER=sqlite`.
- SQLite remains the deterministic local fallback and requires no external service.
- Postgres request storage is activated only when `DATABASE_PROVIDER=postgres` and `DATABASE_URL` are set.

## Validation

Commands:

```bash
npm run validate:phase2
timeout 8s npm run dev
```

Expected checks:

- SQLite async repository smoke test passes for designs, demand, reinforcement, and evolution runs.
- Production Postgres config guard degrades/fails when `DATABASE_URL` is missing.
- Phase 1 validation chain remains stable.
- Normal local startup remains ready without Postgres or Redis.

## Rollback Strategy

Revert the repository interface, Postgres repository implementation, service/route repository calls, and startup storage initialization. SQLite migrations and previous Phase 1 runtime config remain independently usable.

## Next Recommended Phase

Phase 3 should advance automatically after validation and harden replay/event history:

- Introduce append-only event log storage.
- Persist replay checkpoints through the repository interface.
- Expose replay history query endpoints.
- Add deterministic replay validation over stored events.
