# VIKTOR — Expansion Intelligence Memory Ledger

> **Role:** Architecture Authority (Governance Tier 2)
> **Constitutional Binding:** Article I §2, Laws 1–4
> **Last updated:** 2026-05-13

---

## Current Objective

**Phase 3: ERK Foundation** — Build the Emotional Runtime Kernel that translates FAR_NZY gameplay state into deterministic, emotionally continuous music orchestration.

---

## Cognitive Model: FAR_NZY Emotional Topology

### 5 Emotional Phases Observed

| Phase | Game State | Emotional Quality | Intensity |
|-------|-----------|-------------------|-----------|
| Tension Build | NORMAL→PRIME entry | Anticipatory, sparse | 0.1–0.3 |
| Momentum Escalation | PRIME, ladder climbing | Building urgency | 0.3–0.6 |
| Risk Apex | High multiplier, high unbanked | Maximum cognitive load | 0.6–0.85 |
| Frenzy/Catharsis | FRENZY mode, energy drain | Aggressive, unstable | 0.85–1.0 |
| Resolution | BANK/WIN or FARKLE/COLLAPSE | Release, finality | Variable |

### Key FAR_NZY State Variables (Receptor Inputs)

| Variable | Source | Maps To |
|----------|--------|---------|
| `multiplierStep` (0–5) | farkleStore | tension |
| `energy` (0–300) + `mode` | farkleStore | momentum |
| `unbanked / (banked + unbanked)` | farkleStore | risk |
| `disruptions.length` + `mode === 'FRENZY'` | farkleStore | chaos |
| `banked / WIN_SCORE` | farkleStore + useFarkleGame | resolution |

### Leitmotif Clusters

```text
A — Sacred/Celestial:    Gate of Holy Spirits, Gates of Heaven,
                         Land of Benediction, Requiem of the Gods
B — Profane/Demonic:     Gates of Hell, Demonic Banquet, Black Banquet,
                         Strange Bloodlines
C — Baroque/Dance:       Golden Dance, Waltz of the Pearls, Crystal Teardrops,
                         Wood-Carved Partita, Dance of Illusions
D — Atmospheric/Liminal: Silence, Wandering Ghosts, The Lost Portrait,
                         Tower of Evil Mist, Rainbow's Cemetery
E — Narrative/Processional: Prologue, Symphony of the Night, Master Librarian,
                            The Festival of Servants, The Poetic Ballad of Death
```

---

## Decisions Made This Session

| ID | Decision | Rationale |
|----|----------|-----------|
| VD-001 | EmotionalStateVector = 5 axes (tension, momentum, risk, chaos, resolution) | Minimal complete representation of FAR_NZY emotional phases |
| VD-002 | Leitmotif mutations bounded: ±15% tempo, ±2 semitones, family-internal voicing | Law 2 compliance — preserves thematic identity |
| VD-003 | All transitions use DeterministicPRNG seeds | Law 1 compliance — same state = same music |
| VD-004 | Cross-cluster transitions require pivot-chord modulation (never hard-cut) | Law 2 compliance — emotional continuity |

---

## Pending Submissions to @CodeRabbit

- [ ] ERK Receptor module (`src/erk/receptor.ts`) — survivability review
- [ ] Leitmotif Registry (`src/erk/leitmotifs.ts`) — survivability review
- [ ] Harmonic Transition Engine (`src/erk/transitions.ts`) — survivability review

---

## Constraints Active

- ❌ Cannot bypass constitutional constraints
- ❌ Cannot generate unbounded/non-deterministic procedural logic
- ✅ May authorize phase advancements
- ✅ May propose architecture mutations
- ⚠️ Must submit all topological expansions to @CodeRabbit before merge
