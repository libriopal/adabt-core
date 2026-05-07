# CHECKPOINT PHASE 1: Database and Queue Runtime

## Objective

Phase 1 adds explicit database and queue runtime plumbing while keeping Phase 0 local startup deterministic and service-free.

## Implemented

- Added database runtime config with `DATABASE_PROVIDER=sqlite|postgres`, `DATABASE_PATH`, `DATABASE_URL`, and `RUN_MIGRATIONS`.
- Added explicit migration runner command: `npm run migrate`.
- Added SQLite migration execution through `schema_migrations` and wired backend startup to apply SQLite migrations.
- Added Postgres migration adapter and baseline Postgres schema under `apps/backend/migrations/postgres/`.
- Added queue runtime config that uses Redis when `REDIS_HOST` is set and deterministic local fallback when it is not.
- Updated runtime diagnostics to report database provider, Postgres configuration, Redis configuration, and queue mode.
- Added `npm run validate:phase1`.

## Local Defaults

- Database provider: SQLite.
- SQLite path: `./data/slotgpt.db` from the backend working directory.
- Queue mode: deterministic local fallback unless `REDIS_HOST` is set.
- Redis: optional for local dev startup.
- Postgres: migration adapter available, not required for local dev startup.

## Validation

Commands:

```bash
npm run validate:phase1
```

Expected checks:

- SQLite migration runner applies the baseline schema in memory.
- Frontend build passes.
- Backend build passes.
- Backend Vitest suite passes.
- Deterministic replay and cocoon parity remain stable.
- Whitespace check passes.

## Rollback Strategy

Revert the migration runner, database runtime config, Postgres baseline migration, queue runtime fallback, and related script/doc updates. Existing SQLite tables are idempotent and do not require data migration rollback.

## Next Recommended Phase

Phase 2 should continue one phase forward automatically after validation and complete the production storage cutover work:

- Async repository interface for request-time storage.
- Postgres-backed implementation for designs, evolution runs, demand cache, and reinforcement events.
- SQLite implementation behind the same interface for deterministic local fallback.
- Readiness checks that fail production Postgres runtime when `DATABASE_URL` is missing.
