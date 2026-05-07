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

Phase 4 replay operations and continuity export anchoring can be checked with:

```bash
npm run validate:phase4
```

Phase 5 replay recovery actions can be checked with:

```bash
npm run validate:phase5
```

Phase 6 replay observability persistence can be checked with:

```bash
npm run validate:phase6
```

Phase 7 controlled release gates can be checked with:

```bash
npm run validate:phase7
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
- `GET /api/release/readiness`
- `GET /api/release/evidence`
- `GET /api/release/evidence/export`
- `GET /api/release/evidence/compare`
- `GET /api/release/evidence/:evidenceId`
- `POST /api/release/decisions`
- `GET /api/release/decisions`
- `GET /api/replay/verify`
- `GET /api/replay/history`
- `GET /api/replay/monitor`
- `GET /api/replay/monitor/history`
- `POST /api/replay/monitor/:snapshotId/ack`
- `GET /api/replay/checkpoints/diff`
- `GET /api/replay/degraded-export`
- `GET /api/continuity/status`
- `GET /api/continuity/export`
- `POST /api/continuity/:runId/interrupt`
- `POST /api/continuity/:runId/resume`
- `WS /ws/continuity`

## State

Backend SQLite runtime files are intentionally ignored. Local runtime defaults to `DATABASE_PROVIDER=sqlite` and `DATABASE_PATH=./data/slotgpt.db`. Phase 11 routes request-time storage, replay event history, replay checkpoints, monitor snapshots, continuity exports, checkpoint diffs, degraded replay exports, release readiness gates, release evidence archives, release decisions, decision reconciliation records, release bundle summaries, retention planning, post-release drift checks, drift overrides, and release supervision cards through the operational replay path. Use `DATABASE_PROVIDER=postgres` plus `DATABASE_URL` for Postgres-backed request storage.

## Phase 8 Validation

```bash
npm run validate:phase8
npm run preflight:docker -- --api-url=http://localhost:3001/api --rollback-check=true
```

## Phase 9 Validation

```bash
npm run validate:phase9
npm run artifact:release-evidence -- --api-url=http://localhost:3001/api --provider=railway --output=/tmp/agros-release-evidence.json
```

## Phase 10 Validation

```bash
npm run validate:phase10
```

Phase 10 adds release closure endpoints for accepted decision reconciliation, release bundle summary generation, dry-run evidence retention planning, and post-release drift checks keyed to the accepted decision signature.

## Phase 11 Validation

```bash
npm run validate:phase11
npm run artifact:release-bundle -- --api-url=http://localhost:3001/api --decision-id=<decision-id> --environment=staging --output=/tmp/agros-release-bundle-summary.json
```

Phase 11 adds release supervision cards, drift override records, retention policy presets, and CI-driven bundle summary artifact publication.

## Phase 12 Validation

```bash
npm run validate:phase12
npm run release:ci-check -- --api-url=http://localhost:3001/api --promotion-id=<promotion-id> --name=github-actions --status=passed
npm run artifact:promotion-timeline -- --api-url=http://localhost:3001/api --promotion-id=<promotion-id> --output=/tmp/agros-release-promotion-timeline.json
```

Phase 12 adds managed promotion windows, environment-specific deployment command descriptors, CI check attachment hooks, and promotion timeline exports for audit and incident handoff.

## Phase 13 Validation

```bash
npm run validate:phase13
npm run release:rollback-ci-check -- --api-url=http://localhost:3001/api --rollback-id=<rollback-id> --name=github-actions-rollback --status=passed
npm run artifact:rollback-timeline -- --api-url=http://localhost:3001/api --rollback-id=<rollback-id> --output=/tmp/agros-release-rollback-timeline.json
```

Phase 13 adds post-promotion rollback records, rollback command descriptors guarded by failed promotion timelines, rollback CI evidence hooks, and rollback timeline exports for audit and incident handoff.

## Phase 14 Validation

```bash
npm run validate:phase14
npm run artifact:evidence-manifest -- --api-url=http://localhost:3001/api --decision-id=<decision-id> --promotion-id=<promotion-id> --rollback-id=<rollback-id> --output=/tmp/agros-release-evidence-manifest.json
npm run release:verify-artifacts -- --api-url=http://localhost:3001/api --manifest=/tmp/agros-release-evidence-manifest.json --release-bundle=/tmp/agros-release-bundle-summary.json --promotion-timeline=/tmp/agros-release-promotion-timeline.json --rollback-timeline=/tmp/agros-release-rollback-timeline.json
```

Phase 14 adds signed release evidence manifests, uploaded artifact verification, dashboard mismatch triage, and CI verification for handoff artifacts before publication.
