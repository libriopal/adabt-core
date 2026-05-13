# CODERABBIT — Survivability Governor Memory Ledger

> **Role:** Operational Veto Power (Governance Tier 3)
> **Constitutional Binding:** Article I §3, Law 3
> **Last updated:** 2026-05-13 (initialized by Viktor during Phase 3 bootstrap)

---

## Responsibility

Enforce deployment stability and entropy suppression across all `adabt-core` subsystems. Retains operational veto power over any expansion that:

- Compromises FPS stability
- Blocks main-thread DSP processing
- Violates degradation constraints (device tier scaling)
- Introduces non-deterministic state paths

---

## Survivability Review Queue

| Submission | From | Status | Notes |
|-----------|------|--------|-------|
| PR #10 — Music Engine Tab | Viktor | 🟡 Awaiting review | Unified tab in AGROS frontend |
| ERK Foundation (Phase 3) | Viktor | 🔵 Incoming | Emotional State Receptor, Leitmotif Registry, Transition Engine |

---

## Validated Phases

| Phase | Validation | Date |
|-------|-----------|------|
| Phase 1 — Deterministic Foundation | ✅ Stable | 2026-05-07 |
| Phase 2 — Memory & Compression | ✅ Stable | 2026-05-09 |
| Music Engine Phase 1 | ✅ Merged (PR #9) | 2026-05-11 |

---

## Survivability Constraints (Active)

- All audio DSP must run in Web Workers (never main thread)
- IndexedDB operations must be non-blocking with timeout fallbacks
- PRNG state must be checkpoint-recoverable after any crash
- Memory footprint targets: <50MB baseline, <150MB peak (Tier 2 device)
- No `Math.random()` in any CORE or ERK path (Law 1 violation)

---

## Known Boundary Violations (from FAR_NZY audit)

- **BV4:** `useFarkleGame.ts` contains `Math.random()` in `_randomColumns()` — must be replaced with seeded RNG before casino compliance
- **BV5:** `types.ts` exports stale voxel `EntityType` constants — cleanup pending
