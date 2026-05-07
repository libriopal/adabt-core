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

6. Export continuity anchored to the latest replay checkpoint:

   ```bash
   curl 'http://localhost:3001/api/continuity/export?stream=agros-replay-suite&limit=20'
   ```

7. Pause a runaway evolution:

   ```bash
   curl -X POST http://localhost:3001/api/continuity/<runId>/interrupt \
     -H 'content-type: application/json' \
     -d '{"reason":"operator recovery"}'
   ```

8. Resume after validation:

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
3. Capture `/api/replay/history` and compare the latest two replay checkpoints.
4. Export `/api/continuity/export` with the degraded checkpoint ID.
5. Check recent code changes touching PRNG, demand weighting, reinforcement gates, cocoon serialization, replay history, or manifest order.
6. Run `node scripts/validate-production.mjs`.
7. Repair checksum instability before re-enabling workers.

## Continuity Failure Response

If websocket continuity or interrupt/resume handling fails:

1. Confirm `/ws/continuity` is routed by the hosting provider.
2. Check `/api/continuity/status`.
3. Pause affected evolution runs.
4. Restart backend after state is flushed to SQLite.
5. Resume only after readiness and replay verification pass.
