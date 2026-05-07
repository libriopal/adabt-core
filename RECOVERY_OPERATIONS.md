# AGROS Recovery Operations

## Recovery Priorities

1. Preserve deterministic seed identity.
2. Preserve replay checksums.
3. Preserve cocoon reconstruction.
4. Preserve backend SQLite state.
5. Preserve explainable diagnostic traces.

## Incident Checklist

1. Check backend health:

   ```bash
   curl http://localhost:3001/api/health
   ```

2. Check readiness:

   ```bash
   curl http://localhost:3001/api/ready
   ```

3. Verify replay:

   ```bash
   curl http://localhost:3001/api/replay/verify
   ```

4. Inspect diagnostics:

   ```bash
   curl http://localhost:3001/api/diagnostics
   ```

5. Inspect replay history:

   ```bash
   curl 'http://localhost:3001/api/replay/history?stream=agros-replay-suite&limit=20'
   ```

6. Check replay monitor status:

   ```bash
   curl 'http://localhost:3001/api/replay/monitor?stream=agros-replay-suite'
   ```

7. Compare replay checkpoints when degradation is suspected:

   ```bash
   curl 'http://localhost:3001/api/replay/checkpoints/diff?baseId=<baseCheckpoint>&targetId=<targetCheckpoint>'
   ```

8. Inspect monitor snapshot history:

   ```bash
   curl 'http://localhost:3001/api/replay/monitor/history?stream=agros-replay-suite&limit=20'
   ```

9. Acknowledge an accepted replay monitor alert:

   ```bash
   curl -X POST 'http://localhost:3001/api/replay/monitor/<snapshotId>/ack' \
     -H 'content-type: application/json' \
     -d '{"acknowledgedBy":"operator"}'
   ```

10. Export continuity anchored to the latest replay checkpoint:

   ```bash
   curl 'http://localhost:3001/api/continuity/export?stream=agros-replay-suite&limit=20'
   ```

11. Export a degraded replay recovery bundle:

   ```bash
   curl 'http://localhost:3001/api/replay/degraded-export?stream=agros-replay-suite&snapshotId=<snapshotId>&limit=20'
   ```

12. Check release readiness before promotion:

   ```bash
   curl 'http://localhost:3001/api/release/readiness?stream=agros-replay-suite'
   ```

13. Pause a runaway evolution:

   ```bash
   curl -X POST http://localhost:3001/api/continuity/<runId>/interrupt \
     -H 'content-type: application/json' \
     -d '{"reason":"operator recovery"}'
   ```

14. Resume after validation:

   ```bash
   curl -X POST http://localhost:3001/api/continuity/<runId>/resume \
     -H 'content-type: application/json' \
     -d '{}'
   ```

## Database Recovery

Production SQLite must live on a persistent volume. If the database is missing:

1. Stop the backend.
2. Restore the latest volume snapshot if available.
3. If no snapshot exists, initialize a clean database with `apps/backend/migrations/001_initial_schema.sql`.
4. Restart the backend.
5. Run replay and diagnostics verification.

## Replay Failure Response

If replay verification fails:

1. Stop workers by setting `ENABLE_WORKERS=false`.
2. Capture `/api/diagnostics`.
3. Run recovery verification with `/api/replay/verify?persist=false` to avoid appending diagnostic events.
4. Capture `/api/replay/monitor` and `/api/replay/history`.
5. Compare the latest stable and degraded checkpoints with `/api/replay/checkpoints/diff`.
6. Export `/api/replay/degraded-export` with the monitor snapshot ID.
7. Acknowledge the monitor snapshot only after a recovery owner accepts the alert.
8. Export `/api/continuity/export` with the degraded checkpoint ID.
9. Check recent code changes touching PRNG, demand weighting, reinforcement gates, cocoon serialization, replay history, or manifest order.
10. Run `node scripts/validate-production.mjs`.
11. Repair checksum instability before re-enabling workers.

## Deployment Monitoring

Railway:

- Add a lightweight monitor command that calls `/api/replay/monitor` after deploy and records the JSON response in deploy logs.
- Alert when the endpoint returns HTTP 503 or when `monitor.status` is `degraded`.
- Keep `DATABASE_PROVIDER=postgres` and `DATABASE_URL` configured before enabling production workers.

Render:

- Add `/api/ready` as the health check path and run `/api/replay/monitor` from a scheduled external check.
- Store degraded replay bundles from `/api/replay/degraded-export` with incident artifacts.
- Confirm persistent disk or Postgres storage before relying on monitor trend history.

Local Docker:

- Run `docker compose up --build`, then poll `/api/replay/monitor` before running replay append operations.
- Mount SQLite `./data` as a persistent volume if Postgres is not configured.
- Export `/api/replay/degraded-export` before recreating containers during recovery.

## Release Go/No-Go

Before a release promotion:

1. Run `/api/release/readiness`.
2. Proceed only when the release status is `ready`.
3. Treat `blocked` as a hard stop until the latest replay alert is acknowledged or resolved.
4. Treat `degraded` as an operator exception path that requires a written release note.
5. Export `/api/release/evidence/export` and attach the JSON to the release record.
6. Run the provider preflight command with rollback evidence enabled:

   ```bash
   npm run preflight:railway -- --api-url=https://<railway-backend>/api --rollback-check=true
   npm run preflight:render -- --api-url=https://<render-backend>/api --rollback-check=true
   npm run preflight:docker -- --api-url=http://localhost:3001/api --rollback-check=true
   ```

7. If release status is `degraded` or `blocked`, confirm the release evidence export includes a degraded replay bundle checksum before rollback or exception handling.
8. Record the final go/no-go/exception outcome with `POST /api/release/decisions`.
9. For multi-provider promotions, compare `/api/release/evidence/compare?providers=railway,render,local-docker` before final handoff.
10. Reconcile the accepted decision with commit, branch, PR, and source-thread metadata using `POST /api/release/reconciliations`.
11. Capture `/api/release/bundle-summary?decisionId=<decision-id>` as the operator handoff record.
12. Run `/api/release/drift?decisionId=<decision-id>` after promotion and treat degraded drift as a rollback or exception review trigger.
13. Use `POST /api/release/evidence/retention` with `dryRun: true` before deleting old release evidence records.
14. Generate `/api/release/supervision-card?decisionId=<decision-id>&environment=<local|staging|production>` for the active promotion window.
15. If drift is operator-accepted, record the reason with `POST /api/release/drift-overrides` before continuing.
16. Fetch `/api/release/deployment-commands?environment=<local|staging|production>` and choose the command guarded by the supervised card.
17. Start the promotion window with `POST /api/release/promotions`, then transition it through approval, stop, deployment, or failure with `POST /api/release/promotions/<promotion-id>/transition`.
18. Attach CI monitor evidence with `POST /api/release/promotions/<promotion-id>/ci-checks` before final deployment transition.
19. Export `/api/release/promotions/<promotion-id>/timeline` and store it with incident, audit, or release handoff artifacts.
20. For failed or degraded promotions, fetch `/api/release/rollback-commands?environment=<local|staging|production>`.
21. Plan rollback with `POST /api/release/rollbacks`, then transition it through approval, rehearsal, execution, failure, or cancellation with `POST /api/release/rollbacks/<rollback-id>/transition`.
22. Attach rollback CI monitor evidence with `POST /api/release/rollbacks/<rollback-id>/ci-checks`.
23. Export `/api/release/rollbacks/<rollback-id>/timeline` and store it with incident, audit, or rollback handoff artifacts.

## Continuity Failure Response

If websocket continuity or interrupt/resume handling fails:

1. Confirm `/ws/continuity` is routed by the hosting provider.
2. Check `/api/continuity/status`.
3. Pause affected evolution runs.
4. Restart backend after state is flushed to SQLite.
5. Resume only after readiness and replay verification pass.
