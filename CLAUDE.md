# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AGROS (Adaptive Generative Research Operating System)** is a browser-native distributed platform for procedural music generation driven by gameplay emotional states. The system maps game state → emotional inference → symbolic runtime → procedural orchestration → DSP/audio output (the ERK pipeline).

## Commands

```bash
# Install all dependencies (root + workspaces)
npm run install:all

# Build everything (frontend then backend)
npm run build

# Build individually
cd apps/frontend && npm run build
cd apps/backend && npm run build

# Dev servers (run separately)
cd apps/frontend && npm run dev        # Vite dev server
cd apps/backend && npm run dev         # tsx watch with .env file

# Start backend production server (port 3001)
npm start

# Run backend tests
cd apps/backend && npm test            # vitest
```

## Architecture

### Monorepo layout
- `apps/frontend/` — React 18 + Vite + TypeScript browser app
- `apps/backend/` — Express + TypeScript + better-sqlite3 API server
- `constitution/` — Operational law and governance docs (immutable)
- `governance/checkpoints/` — Architecture state snapshots written on merge
- `shared/` — Cross-workspace shared types and the project memory ledger

### Frontend module structure (`apps/frontend/src/`)
- `agros/init.ts` — System bootstrap entrypoint
- `engine/` — Intent vectors, content rendering, mechanic mapping, scoring
- `memory/` — Contextual memory graphs, manifolds, geometry abstraction
- `compression/` — Semantic compression engine
- `checkpoints/` — Resumable state snapshots (IndexedDB-backed)
- `storage/` — IndexedDB persistence layer
- `struthio/` — Defensive integrity and drift detection mesh (STRUTHIO-SEC)
- `debug/` — Metrics collection and trace logging / real-time debug panel
- `registry/` — Architecture manifest system

### Backend services (`apps/backend/src/`)
- `evolutionEngine.ts` — Genetic algorithm for design evolution
- `demandEngine.ts` — NLP-based market sentiment/trend analysis
- `reinforcementEngine.ts` — Reward scoring system
- `batchGenerator.ts` — Batch operations coordinator
- `workers/` — Background jobs; require Redis but degrade gracefully without it
- Database: SQLite with WAL journaling via better-sqlite3

### Data flow
```
FAR_NZY game state → Emotional Inference → Symbolic Runtime State
  → Procedural Orchestration → DSP Runtime → Adaptive Audio Output
```

## Key Conventions

**Deterministic PRNG** — All randomness must use seeded `DeterministicPRNG`; never use `Math.random()` directly. This ensures replays and multiplayer synchronization are reproducible.

**8 canonical emotional states** — Dread, Suspense, Escalation, Catastrophic Release, Mourning, Recovery, Silence, Ritualistic Build. Engine logic maps to these states; do not add new ones without constitutional review.

**Tiered cognitive fidelity** — Hardware capability is detected at runtime and scales FFT density and orchestration complexity (Tier 0–4). Tier 0 has a 12ms DSP latency ceiling enforced by `dsp-survivability.yml` CI.

**COOP/COEP headers required** — `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers must be set (Railway deployment) to enable `SharedArrayBuffer` for DSP worklets. See the gate in the backend middleware.

**Dual storage** — Frontend persists to browser IndexedDB; backend persists to SQLite. Do not conflate the two layers.

**Symbolic replication for multiplayer** — Authoritative seeds/states only; local clients apply orchestral decoration deterministically from those seeds.

## Governance

The project uses a constitutional governance model defined in `constitution/operational-law.md`. Four immutable laws:
1. **Deterministic Emergence** — all outputs reproducible from seed + state
2. **Emotional Continuity** — the 8-state emotional model is the canonical interface
3. **Deployment Survivability** — system must degrade gracefully across all tiers
4. **Memory Continuity** — architecture state must be snapshotted on every merge

**Memory ledgers** that must stay updated: `/shared/project-memory.md`, `/viktor.md`, `/coderabbit.md`. The `constitutional-governance.yml` CI workflow enforces ledger updates on PRs.

**Current phase:** Phase 2 complete (memory + compression layer). Phases 3–8 cover evolution, reinforcement, demand intelligence, and multi-agent coordination.

## CI Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `constitutional-governance.yml` | PR | Enforces memory ledger updates |
| `dsp-survivability.yml` | PR/push | DSP latency audit (12ms Tier 0 ceiling) |
| `entropy-monitor.yml` | Daily | Architecture drift scanning |
| `slack-notify.yml` | Push to main/dev | Slack merge notifications |
