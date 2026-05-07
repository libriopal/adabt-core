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
- `GET /api/continuity/status`
- `POST /api/continuity/:runId/interrupt`
- `POST /api/continuity/:runId/resume`
- `WS /ws/continuity`

## State

Backend SQLite runtime files are intentionally ignored. In production, set `DATABASE_PATH` to a persistent volume path such as `/data/slotgpt.db`.
