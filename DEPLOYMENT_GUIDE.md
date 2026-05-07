# AGROS Deployment Guide

## Required Runtime

- Node.js 24
- npm
- SQLite persistent storage for backend state
- Redis when `ENABLE_WORKERS=true`

## Environment

Copy the templates before local deployment:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Important variables:

- `FRONTEND_URL`: deployed frontend origin.
- `VITE_API_URL`: frontend API base URL, usually `https://<backend>/api`.
- `DATABASE_PROVIDER`: `sqlite` for deterministic local/runtime fallback or `postgres` for Postgres-backed request storage.
- `DATABASE_PATH`: backend SQLite path. In production SQLite fallback mode, use a persistent volume, for example `/data/slotgpt.db`.
- `DATABASE_URL`: Postgres connection string used by migrations and request-time storage when `DATABASE_PROVIDER=postgres`.
- `RUN_MIGRATIONS`: set to `false` only when migrations are handled externally.
- `ENABLE_WORKERS`: set `true` only when Redis is configured.
- `REDIS_HOST` and `REDIS_PORT`: worker queue backend.
- `LOG_LEVEL`: `debug`, `info`, `warn`, or `error`.

## Local Docker

```bash
docker compose up --build
npm run preflight:docker -- --api-url=http://localhost:3001/api
npm run preflight:docker -- --api-url=http://localhost:3001/api --rollback-check=true
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Backend health: `http://localhost:3001/api/health`
- Backend readiness: `http://localhost:3001/api/ready`
- Continuity websocket: `ws://localhost:3001/ws/continuity`

## Vercel Frontend

The repository includes `vercel.json` for `apps/frontend`.

Set this environment variable in Vercel:

```text
VITE_API_URL=https://<backend-host>/api
```

Vercel build command:

```bash
npm ci --prefix apps/frontend && npm run build --prefix apps/frontend
```

Output directory:

```text
apps/frontend/dist
```

## Railway Backend

The repository includes `railway.json` for Dockerfile deployment.

Recommended variables:

```text
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
DATABASE_PATH=/data/slotgpt.db
DATABASE_PROVIDER=sqlite
DATABASE_URL=
RUN_MIGRATIONS=true
ENABLE_WORKERS=true
FRONTEND_URL=https://<vercel-frontend>
REDIS_HOST=<railway-redis-host>
REDIS_PORT=<railway-redis-port>
```

Mount persistent storage at `/data`.

For Postgres-backed production storage, set:

```text
DATABASE_PROVIDER=postgres
DATABASE_URL=<postgres-connection-string>
RUN_MIGRATIONS=true
```

Production startup fails when `DATABASE_PROVIDER=postgres` is selected without `DATABASE_URL`.

After deployment, run:

```bash
npm run preflight:railway -- --api-url=https://<railway-backend>/api
npm run preflight:railway -- --api-url=https://<railway-backend>/api --rollback-check=true
```

## Render Backend

The repository includes `render.yaml`.

Before deploying, set the synced `FRONTEND_URL` to the Vercel origin. The backend disk mounts at `/data`, and the backend service uses `/api/health` as its health check path.

After deployment, run:

```bash
npm run preflight:render -- --api-url=https://<render-backend>/api
npm run preflight:render -- --api-url=https://<render-backend>/api --rollback-check=true
```

## Android Termux Development

Termux should use direct Node/npm execution:

```bash
npm ci --prefix apps/frontend
npm ci --prefix apps/backend
npm run build --prefix apps/frontend
npm run build --prefix apps/backend
npm test --prefix apps/backend
```

Use `DATABASE_PATH=./apps/backend/data/slotgpt.db` for local development. Docker is not required for Termux.

## Production Validation

Run:

```bash
node scripts/validate-production.mjs
```

Provider release preflight:

```bash
npm run preflight:release -- --provider=railway --api-url=https://<backend>/api
npm run preflight:release -- --provider=railway --api-url=https://<backend>/api --rollback-check=true
npm run artifact:release-evidence -- --provider=railway --api-url=https://<backend>/api --output=outputs/release-evidence.json
```

This validates:

- frontend build
- backend build
- backend tests
- deterministic evolution replay checksum parity
- cocoon reconstruction stability
- cocoon replay stability
- whitespace-safe diff

## CI Template

`deploy/github-actions-ci.yml` contains the GitHub Actions workflow template for repository maintainers to install under `.github/workflows/ci.yml`. It is kept under `deploy/` because GitHub App credentials without workflow permission cannot push directly to `.github/workflows`.

Set `AGROS_API_URL` and optionally `AGROS_RELEASE_PROVIDER` in CI to upload a release evidence artifact after validation. Set `AGROS_RELEASE_DECISION_ID` and optionally `AGROS_RELEASE_ENVIRONMENT` to upload a release bundle summary artifact after promotion. Set `AGROS_RELEASE_PROMOTION_ID` to attach the CI check result to the managed promotion window and upload the promotion timeline artifact. Set `AGROS_RELEASE_ROLLBACK_ID` to attach rollback CI evidence and upload the rollback timeline artifact. When `AGROS_RELEASE_DECISION_ID` is set, CI also generates a signed release evidence manifest and verifies the exported handoff artifacts before upload.

After promotion, record the final decision with `/api/release/decisions`, reconcile it with the deployed commit using `/api/release/reconciliations`, capture `/api/release/bundle-summary`, generate `/api/release/supervision-card`, start `/api/release/promotions`, attach CI results with `/api/release/promotions/<promotion-id>/ci-checks`, export `/api/release/promotions/<promotion-id>/timeline`, and run `/api/release/drift` against the accepted decision signature. For failed or degraded promotions, plan `/api/release/rollbacks`, attach rollback CI with `/api/release/rollbacks/<rollback-id>/ci-checks`, and export `/api/release/rollbacks/<rollback-id>/timeline`. Before publication, generate `/api/release/evidence/manifest` and verify uploaded artifacts with `/api/release/evidence/verify-artifacts`. If drift is accepted as an operator exception, record it with `/api/release/drift-overrides`.
