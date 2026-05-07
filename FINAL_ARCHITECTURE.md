# AGROS Final Architecture

This document captures the production-ready architecture for the Adaptive Generative Research Operating System (AGROS) after Phase 6 stabilization and production preparation.

## System Map

```text
Browser UI
  |
  |-- Deterministic dashboards
  |-- Evolution simulator
  |-- Demand intelligence panel
  |-- Reinforcement optimizer panel
  |-- Cocoon topology and replay inspectors
  |-- STRUTHIO-SEC debug panels
  |
  v
Backend API
  |
  |-- Request context and runtime validation middleware
  |-- Structured JSON logging
  |-- Health, readiness, diagnostics, replay verification
  |-- Demand ingestion abstraction
  |-- Reinforcement replay engine
  |-- Evolution orchestration
  |-- Continuity websocket hub
  |
  v
Persistence and Workers
  |
  |-- SQLite WAL database on persistent volume
  |-- Redis-backed worker coordination when enabled
  |-- Migration script baseline
  |-- Recovery checkpoints and deterministic replay checks
```

## Production Layers

1. Deterministic Core: seed-locked PRNG and checkpoint-compatible state capture.
2. Evolution Layer: deterministic mutation, scoring, selection, lineage, and epoch replay.
3. Demand Intelligence: deterministic source adapters and weighted trend outputs.
4. Reinforcement Layer: reward shaping, gates, mutation weighting, and replay verification.
5. Context Collapse Compression: semantic graph abstraction, manifold encoding, cocoon serialization, metadata, replay, and reconstruction verification.
6. STRUTHIO-SEC Mesh: integrity, drift, recovery, and consensus loops.
7. Runtime Diagnostics: request IDs, structured logs, readiness, replay verification, and centralized diagnostics.
8. Deployment Layer: Docker, Vercel frontend manifest, Railway/Render backend manifests, CI validation, and environment templates.

## Runtime Boundaries

- Frontend lives in `apps/frontend` and is deployed to Vercel or served by the frontend Docker image.
- Backend lives in `apps/backend` and is deployed to Railway, Render, or local Docker.
- SQLite is the durable backend state store. Production deployments must mount `DATABASE_PATH` to persistent storage.
- Redis is optional for local API operation, but required when production workers are enabled.
- Continuity websocket traffic uses `/ws/continuity`.

## Architecture Continuity

The architecture registry in `apps/frontend/src/registry/manifest.ts` is the canonical frontend topology map. It now points at implemented Phase 3-6 modules, including STRUTHIO-SEC recovery and consensus modules.

## Stabilization Audit

Fixed during production preparation:

- Added Docker, Vercel, Railway, Render, CI template, env templates, migration baseline, and production validation script.
- Removed tracked runtime SQLite files from version control and moved runtime state behind ignored persistent-volume paths.
- Added backend structured logging, request context, runtime validation middleware, diagnostics, readiness, replay verification, and continuity control endpoints.
- Added websocket continuity support for interrupt/resume events.
- Repaired STRUTHIO-SEC manifest drift by adding recovery and consensus modules.

Known bounded systems:

- Demand ingestion remains adapter-based and deterministic; live external scraping should be enabled source-by-source behind explicit adapters.
- Worker orchestration is production-configurable, but hosted worker scale-out should be validated on the selected provider.
- Android Termux support is development-oriented and should use local Node/npm commands rather than Docker.
