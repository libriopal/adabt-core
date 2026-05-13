# ADABT-CORE — Project Memory Ledger

> **Authority:** Constitution v1.0.0
> **Last updated:** 2026-05-13 (Viktor — Phase 3 Bootstrap)

---

## Phase History

| Phase | Name | Status | Date | Agent |
|-------|------|--------|------|-------|
| 1 | Deterministic Foundation | ✅ Complete | 2026-05-07 | Sovereign + CodeRabbit |
| 2 | Memory & Compression Layer | ✅ Complete | 2026-05-09 | Sovereign + CodeRabbit |
| 2.5 | Music Engine (Phase 1) | ✅ Complete (PR #9 merged) | 2026-05-11 | CodeRabbit |
| 2.6 | Music Engine Tab (Unified) | 🟡 PR #10 Open | 2026-05-12 | Viktor proposal |
| 3 | ERK Foundation | 🔵 In Progress | 2026-05-13 | Viktor |

---

## Architectural Decisions

### AD-001: Deterministic PRNG (Mulberry32)
- **Decision:** All procedural generation uses `DeterministicPRNG` (Mulberry32) with `.getState()` for checkpoint capture.
- **Rationale:** Law 1 (Deterministic Emergence). Same seed = same musical output across all clients.
- **Files:** `apps/frontend/src/utils/prng.ts`

### AD-002: Memory Persistence via IndexedDB
- **Decision:** All session state persists to IndexedDB, never ephemeral prompt context.
- **Rationale:** Law 4 (Memory Continuity).
- **Files:** `apps/frontend/src/memory/`

### AD-003: FAR_NZY as Emotional Source Environment
- **Decision:** Farkle Frenzy v3 gameplay state machine is the canonical emotional-state source. The ERK reads game state vectors (energy mode, multiplier step, chain streak, disruption events) and translates them into musical parameters.
- **Rationale:** Constitution Article I + System Instruction to Viktor.
- **Binding:** All emotional mappings must be traceable to FAR_NZY state variables.

### AD-004: Leitmotif Cluster System
- **Decision:** 23 training tracks (Castlevania SotN corpus) clustered into 5 thematic groups (Sacred, Profane, Baroque, Atmospheric, Narrative). Procedural mutations must stay within cluster harmonic identity.
- **Rationale:** Law 2 (Emotional Continuity).
- **Mutation bounds:** ±15% tempo, ±2 semitone transposition, voicing swap within instrument family.

### AD-005: ERK EmotionalStateVector Interface
- **Decision:** Normalized 5-axis emotional vector: `tension`, `momentum`, `risk`, `chaos`, `resolution` (all 0–1).
- **Rationale:** Minimal-dimension emotional representation that captures all FAR_NZY gameplay phases.
- **Mapping:** See `src/erk/receptor.ts` for FAR_NZY state → vector translation.

---

## Open Questions

- [ ] PR #10 merge decision (Music Engine tab consolidation)
- [ ] Multiplayer sync protocol design (Hybrid Symbolic Replication — per Constitution Article III)
- [ ] Device tier degradation thresholds (Tier 0–4 scaler not yet specified)

---

## Repository Topology

```
adabt-core/
├── apps/frontend/src/
│   ├── engine/          # Intent vector, scoring, mechanic mapping, content rendering
│   ├── memory/          # Semantic graph, manifold, geometry, cocoon compression
│   ├── music/           # Audio ingestion, decode workers, viz, BPM detection
│   ├── erk/             # [NEW] Emotional Runtime Kernel
│   ├── lib/types.ts     # Core type definitions
│   └── utils/prng.ts    # Mulberry32 PRNG
├── shared/              # Memory ledger hierarchy
│   ├── project-memory.md
│   ├── ../viktor.md
│   └── ../coderabbit.md
└── apps/backend/        # Express API, SQLite persistence
```
