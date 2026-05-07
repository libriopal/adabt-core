# CHECKPOINT PHASE 0: Stabilization

## Objective

Phase 0 makes the repository immediately runnable, locally testable, replayable, and debuggable without Docker, Redis, Postgres, Railway, or external services.

## Implemented

- Added root `package.json` workspaces and root scripts for `npm install`, `npm run dev`, `npm run build`, `npm test`, `npm run validate`, and `npm run validate:phase0`.
- Added `scripts/dev.mjs` to start frontend and backend together with deterministic local defaults.
- Added `scripts/validate-phase0.mjs` to run frontend build, backend build, backend tests, and replay/cocoon smoke validation.
- Added backend startup validation for runtime environment, SQLite WAL mode, and required SQLite schema.
- Added local-only SQLite corruption quarantine. Corrupt development database files are preserved with a `.corrupt-<timestamp>` suffix and a clean local database is recreated. Production corruption still fails loudly.
- Updated local documentation to match the no-setup root workflow.

## Local Defaults

- Database: SQLite at `./data/slotgpt.db` from the backend working directory.
- Workers: disabled by default with `ENABLE_WORKERS=false`.
- Redis: not required for local dev startup.
- Frontend API URL: `http://localhost:3001/api`.
- Backend port: `3001`.

## Validation

Commands:

```bash
npm install
npm run validate:phase0
timeout 8s npm run dev
```

Results:

- Frontend build passed.
- Backend build passed.
- Backend Vitest suite passed.
- Deterministic evolution replay checksum remained `7241d024`.
- Cocoon replay checksum remained `128b4d2f`.
- Cocoon reconstruction checksum remained `128b4d2f`.
- Root `npm run dev` started Vite and the backend successfully.
- Backend startup validation reported `ready`.

## Rollback Strategy

Remove the root workspace entrypoint files and revert the startup validator integration. Local SQLite corruption quarantine only applies outside production, so production rollback does not require data migration.

## Next Recommended Phase

Phase 1 should add the production database abstraction and migration runner:

- Postgres production adapter.
- SQLite local fallback behind one storage interface.
- Explicit migration execution command.
- Redis optional runtime checks with deterministic local queue fallback.
