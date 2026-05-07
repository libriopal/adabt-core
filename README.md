# Adaptive Generative Research Operating System

AGROS is a deterministic adaptive research system for slot-design simulation, semantic compression, replayable evolution, reinforcement scoring, and continuity recovery.

## Applications

- `apps/frontend`: Vite React dashboard for evolution, demand, reinforcement, cocoon topology, replay, and STRUTHIO-SEC debugging.
- `apps/backend`: Express API for generation, evolution orchestration, demand intelligence, reinforcement replay, diagnostics, continuity websocket events, and persistence.

## Quick Start

```bash
npm install
npm run build
npm test
npm run migrate
```

Run local development servers:

```bash
npm run dev
```

Root `npm run dev` starts both apps with local defaults: SQLite, workers disabled, mock/deterministic ingestion, and no Redis, Docker, Railway, Postgres, or cloud service requirement.

## Production Validation

```bash
npm run validate
```

The validation script builds both apps, runs backend tests, verifies deterministic evolution replay parity, verifies cocoon reconstruction, verifies cocoon replay, and runs `git diff --check`.

Phase 0 local stabilization can be checked with:

```bash
npm run validate:phase0
```

Phase 1 database and queue runtime plumbing can be checked with:

```bash
npm run validate:phase1
```

Phase 2 async repository and production storage guardrails can be checked with:

```bash
npm run validate:phase2
```

Phase 3 replay event history and checkpoint persistence can be checked with:

```bash
npm run validate:phase3
```

## Deployment

- Frontend: Vercel with `vercel.json`.
- Backend: Railway with `railway.json` or Render with `render.yaml`.
- Local production: `docker compose up --build`.
- Termux development: direct Node/npm commands; Docker is not required.
- CI template: `deploy/github-actions-ci.yml`.

See `DEPLOYMENT_GUIDE.md` for environment variables and provider-specific setup.

## Production Operations

- `FINAL_ARCHITECTURE.md`: full production architecture.
- `SYSTEM_CONTINUITY.md`: replay, checkpoint, and multi-session continuity model.
- `STRUTHIO_SEC_OVERVIEW.md`: defensive loop behavior.
- `COCOON_PROTOCOL.md`: semantic compression and reconstruction protocol.
- `RECOVERY_OPERATIONS.md`: operational recovery checklist.

## Backend Runtime Endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/diagnostics`
- `GET /api/replay/verify`
- `GET /api/replay/history`
- `GET /api/continuity/status`
- `POST /api/continuity/:runId/interrupt`
- `POST /api/continuity/:runId/resume`
- `WS /ws/continuity`

## State

Backend SQLite runtime files are intentionally ignored. Local runtime defaults to `DATABASE_PROVIDER=sqlite` and `DATABASE_PATH=./data/slotgpt.db`. Phase 3 routes request-time storage, replay event history, and replay checkpoints through an async repository interface with SQLite and Postgres implementations. Use `DATABASE_PROVIDER=postgres` plus `DATABASE_URL` for Postgres-backed request storage.
