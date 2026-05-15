# ◈ DREAM CORE — MEMORY LATTICE ◈
# Indexed Geometric Format: Truncated Octahedron
# Each face is a memory domain. Each vertex is a cross-domain junction.
# Coordinates: [Stratum, Meridian, Depth] — (S, M, D)
# Stratum 0 = Foundation Law | Stratum 1 = Architecture | Stratum 2 = Integration | Stratum 3 = Operational | Stratum 4 = Future
# Generated: 2026-05-15 | Sources: FAR_NZY (core/) + adabt-core dream-core (dream/)

```
         ◆ [4,0,0] FUTURE HORIZON
        /|\
       / | \
      /  |  \
  ◈ [3,W,0]─────◈ [3,E,0]  ← OPERATIONAL RING
    |\ WEST /   \ EAST /|
    | \    /     \    / |
    |  ◇──────────◇──  |
    |  |  LATTICE  |  |
    |  ◇──────────◇──  |
    | /              \ |
  ◈ [3,S,0]─────◈ [3,N,0]
      \  |  /
       \ | /
        \|/
         ◆ [0,0,0] FOUNDATION CORE
```

---

## ◆ VERTEX [0,0,0] — FOUNDATION CORE
> Sacred invariants. Immutable without governance review.

### [0,0,1] SACRED CORE BOUNDARY
**Files**: `packages/farkle-engine/src/`, `packages/farkle-shared/src/types.ts`, `apps/backend/src/gameRoom.ts`
**Law**: No modification without governance + full scoring regression suite.
**Why**: Scoring math and RTP correctness are the casino compliance foundation.

### [0,0,2] SCORING TRUTH TABLE (FAR_NZY audit-verified)
| Combination | Score |
|---|---|
| Three 1s | 1000 |
| Two Triplets | **2500** (not 1200 — critical) |
| Straight (1–6) | 1500 |
| Three Pairs | 1500 |
| Four of a Kind + Pair | 1500 |
| Six of a Kind | 3000 |
| Five of a Kind | 2000 |
| Four of a Kind | 1000 |
| Single 1 | 100 |
| Single 5 | 50 |
**Multiplier ladder**: [1.0, 1.25, 1.5, 2.0, 3.0, 4.0] — hard cap at step 5 (4.0×)

### [0,0,3] DETERMINISM LAW
- All gameplay randomness: `seededRng(seed)` xorshift from `@match3d/farkle-engine`
- Seed entropy source: `crypto.getRandomValues` only — never `Math.random()`
- HMAC-SHA256 CSPRNG in `csprng.ts` for provably-fair protocol
- Multiplayer: authoritative seeds server-side only; clients apply deterministically
- Pre-existing violation: `RhythmEngine.ts` has 6 `Math.random()` calls (non-gameplay, tracked)

### [0,0,4] FOUR CONSTITUTIONAL LAWS
1. **Deterministic Emergence** — all outputs reproducible from seed + state
2. **Emotional Continuity** — 8-state ERK model is the canonical interface
3. **Deployment Survivability** — degrade gracefully across all hardware tiers
4. **Memory Continuity** — architecture state snapshotted on every merge

---

## ◈ FACE [1,N,0] — AUDIO ARCHITECTURE (adabt-core origin)
> 3-thread DSP pipeline. WASM kernel → SharedArrayBuffer → AudioWorklet.

### [1,N,1] THREAD MODEL
```
Main Thread (DSPNode.ts)
  → Web Worker (dsp-worker.ts) owns WasmDSPKernel
    → AudioWorklet (dsp-worklet-processor.ts) pipes to hardware
```
- SAB = `WebAssembly.Memory.buffer` (WASM-owned, not separately allocated)
- Worker production loop: 5ms setInterval, `process(128)` until back-pressure
- Worklet: 128-sample block pull, mono→stereo copy, underrun reporting
- DSPNode state machine: idle → starting → running → stopping → idle

### [1,N,2] SPSC RING BUFFER CONTRACT
- **Monotonic indexing**: WRITE_HEAD and READ_HEAD are ever-increasing uint32
- Mask `& (capacity-1)` applied only at `data[]` access — never to head arithmetic
- Distance = `(write - read) >>> 0` (unsigned subtraction, no mask)
- Full = distance == capacity; Empty = distance == 0 (mathematically distinct — no aliasing)
- Capacity: tier-adaptive (128 Tier 0 → 16384 Tier 4); must be power-of-two
- WRITE_HEAD: release store; READ_HEAD consumer: acquire load

### [1,N,3] WASM DSP KERNEL (C source)
- `g_ring_headers[2]` + `g_audio_data[DSP_MAX_CAPACITY]` — static globals, linker-placed
- No `sab_ptr` offset argument — compiler guarantees no stack/heap overlap
- Exports: `dsp_write_head_ptr()`, `dsp_read_head_ptr()`, `dsp_data_ptr()` → AudioWorklet attaches views at exact BSS addresses
- Hot path: `sinf(2π × phase) × gain → ring buffer` — zero allocations, no IIR (removed Phase 2)
- IIR state (z1[]) retained in struct for Phase 3 filter work
- Emscripten build: Tier 0 = 256KB/1MB/no SIMD; Tier 3+ = SIMD/16MB

### [1,N,4] AUDIO CONTEXT RULES
- `COOP/COEP` headers required: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`
- Required for `SharedArrayBuffer` — enforced in both Vite dev server headers and railway.toml
- Neon Oscilloscope must stay on `requestAnimationFrame` canvas path — never per-sample React re-render
- `AudioContext.resume()` must be called in user gesture handler before `addModule()`

### [1,N,5] ERK EMOTIONAL STATE PIPELINE
```
Game State → ERK Inference → SpectralGenome → Neural Conductor → DreamAudioEngine
```
**8 canonical states** (immutable without constitutional review):
`Dread | Suspense | Escalation | CatastrophicRelease | Mourning | Recovery | Silence | RitualisticBuild`

**SpectralGenome schema**: `{state, bpm, spectralCentroid(Hz), harmonicTension(0–1), dissonance(0–1), motifIntervals[], onsetDensity(0–1), chromaProfile[12], fftBands[4], transitionCurve}`

**Genome → DreamAudioEngine params**:
- `filterCutoff = max(80, spectralCentroid × 2)`
- `gainMultiplier = 0.5 + onsetDensity × 0.8`
- `reverbWet = dissonance × 0.6`
- `lfoRate = harmonicTension × 4 + 0.5`

**Source**: offline extraction from 23 FAR_NZY training MP3s → `/public/spectral-genome/*.json`
Runtime fetches JSON; falls back to `FALLBACK_GENOMES` (manual approximation) until pipeline runs.

---

## ◈ FACE [1,S,0] — GRID ENGINE (FAR_NZY origin)
> Sacred Core grid state machine.

### [1,S,1] GRID ARCHITECTURE
- Column count gated by `playerCount`: 7 (1P) / 8 (2P) / 9 (3P) / 10 (4P)
- `SixPoolManager`: equal-distribution pool, `poolSize = ceil(gridSize²/6)×6`
- Pool reshuffle on depletion — ensures statistical fairness
- `stepGravity`, `spawnTiles`, `applyStandardBomb`, `applyRainbowBomb`, `damageAdjacentBlockers` — all Sacred Core
- Blocker density tiers: LOW=3–4, MEDIUM=5–7, HIGH=8–12

### [1,S,2] ENERGY SYSTEM (FAR_NZY original → Organic Vegas adapted)
**Original FAR_NZY constants**:
- `MAX_ENERGY = 300`, `FRENZY_THRESHOLD = 150`
- PRIME passive: +5/sec; FRENZY passive: -5/sec
- Chain-6 in PRIME: +10 energy; Chains 2-5 in PRIME: -10 energy; FRENZY chain: +10

**Organic Vegas Life-Force wrapper** (wrapper only — Sacred Core energy untouched):
- `MAX_LIFE_FORCE = 300`, `LIFE_FORCE_PER_BANK = +20`, `LIFE_FORCE_PER_FARKLE = -30`
- Combo Break: costs 30 LF, salvages 50 pts from Farkle

---

## ◈ FACE [1,E,0] — HARDWARE TIERING
> LITE/ELITE auto-detection. Mobile-first design.

### [1,E,1] TIER DETECTION
- `WEBGL_debug_renderer_info` extension → GPU score heuristic
- `navigator.hardwareConcurrency` for CPU tier
- Mobile detection: `navigator.userAgent` + `screen.width < 768`
- **Mobile always defaults LITE** regardless of GPU score
- `HARDWARE` singleton: quality, dspTier(0–4), maxDiceBodies, shadowsEnabled, particlesEnabled, postProcessing, audioLayerDensity, isMobile, screenWrap

### [1,E,2] RENDERING DIFFERENCES
| Feature | LITE | ELITE |
|---|---|---|
| Die material | MeshLambertMaterial + emissive tint | Custom ShaderMaterial (iridescent SSS + rim + gold) |
| Bone-gold filigree | Omitted | LineSegments lattice |
| Pixel ratio | 1.0 | `devicePixelRatio` |
| Physics bodies | ≤12 | ≤30 |
| Shadows | Disabled | Enabled |
| Post-processing | None | Bloom + vignette |

### [1,E,3] DSP TIER LATENCY CEILING
- Tier 0: 12ms DSP latency ceiling (enforced by `dsp-survivability.yml` CI)
- Tier 0 render budget: 2.67ms per 128-sample block at 48kHz
- Jitter gate: absolute `max - mean < 1.0ms` (ratio metric abandoned — numerically unstable near zero)

---

## ◈ FACE [2,N,0] — ORGANIC VEGAS INTEGRATION
> Phase 1 dual-repo merge. FAR_NZY core/ → adabt-core dream/ as Project Organic Vegas.

### [2,N,1] ROUTE ARCHITECTURE
- `/organic-vegas` → `OrganicVegasLobby.tsx` (2-player room UI)
- `/organic-vegas/game` → `OrganicVegas.tsx` (game loop)
- Parallel to existing AGROS routes — NOT replacing `/`

### [2,N,2] GAME LOOP INVARIANTS
1. Roll: `seededRng(rngRef.current())` → 6 faces → `scoreFarkle(faces, 1)` → live score
2. Bank: `wrapScore(score)` via dream store → `banked += unbanked × payoutMultiplier`
3. Life-Force: `+20 on bank`, `-30 on Farkle`, `Combo Break: -30 LF / +50 pts salvage`
4. `payoutMultiplier = 1.0` in beta (all genre multipliers RTP-gated)
5. `ultimateRerollLoop` audit-locked: consumes exactly 1 authoritative roll, returns `{blocked: true, reason: 'RTP_WRAPPER_ONLY_NO_REROLL'}`

### [2,N,3] CONFLICT RESOLUTION LAYER
**File**: `packages/dream-core/src/conflictResolution.ts`
**Genre priority**: Horror=1 > Roguelike=2 > Casino=3 > Match3=4 > Rhythm=5 ... Moba=19 > Abstract=20
- All `scoreMultiplier` entries: `rtpGated: true` until 10k Monte Carlo validation
- Hard multiplier cap: **4.0×** (matches Sacred Core `MULTIPLIER_LADDER` max)
- `resolveModifiers(state)`: sorts by priority, applies only non-rtpGated multipliers

### [2,N,4] 3D SCENE (Bio-Architectural Dark Casino)
**Flat 2D = hard fail** — 3D mandatory per Director lock.
- Canvas owned by parent; scene mounts imperatively via `forwardRef` + `useImperativeHandle`
- Rapier3D (WASM): `VoxelPhysicsSystem.create(seed)` async init; `onStep` → `VoxelTransform[]` → `updateTransforms()`
- RAF loop: updates `time` uniform (ELITE shader), heartbeat intensity modulates camera Z
- Collision impulse → `dreamAudio.applyTrickMeter({percussionLayer, bassLayer, leadLayer, filterCutoff, reverbMix})`
- `ResizeObserver` for responsive canvas at correct pixel ratio

### [2,N,5] CSS DESIGN TOKENS
```css
--ov-void: #05030a       /* deep space background */
--ov-gold: #c9a84c       /* bone-gold filigree */
--ov-bone-light: #f0e6c8 /* ossified surface highlight */
--ov-neural-cyan: #00f0ff /* ERK pipeline color */
--ov-blood-red: #b80000  /* farkle / danger */
```

---

## ◈ FACE [2,S,0] — MULTIPLAYER ARCHITECTURE
> WebSocket symbolic replication. Authoritative server.

### [2,S,1] DAY-ONE (2-PLAYER)
- Backend: `ws` library, `http.createServer(app)` → `WebSocketServer({server, path:'/ws'})`
- Room registry: `Map<roomCode, GameRoom>`; `MAX_PLAYERS_PER_ROOM = 2`
- Per-connection: `room`, `playerId`, `playerName` from URL query params
- Turn order: authoritative server-side (CSPRNG-seeded first-player determination)
- **Never client-side turn arbitration**

### [2,S,2] WEBSOCKET MESSAGE PROTOCOL
**Inbound**: `JOIN_ROOM | LEAVE_ROOM | START_GAME | SUBMIT_CHAIN | BANK_SCORE | REQUEST_STATE`
**Outbound**: `ROOM_STATE | PLAYER_JOINED | PLAYER_LEFT | GAME_STARTED | TURN_RESULT | ENERGY_UPDATE | ERROR`
- Symbolic replication only: seeds + scores, no raw frame data

### [2,S,3] NEXT SPRINT — 4-PLAYER PLAN
**Backend changes**:
- `MAX_PLAYERS_PER_ROOM`: 2 → 4
- `teamMode: boolean` flag in `LobbySettings`
- `activePlayerIndex` round-robin through `players[]`
- `ROOM_STATE` broadcast: per-player banked scores + turn order array

**Frontend changes**:
- `OrganicVegasLobby.tsx`: 4 player slots
- `OrganicVegas.tsx`: 3 opponent HUD panels
- `shared/gameConfig.ts`: shared constants to keep frontend/backend in sync

**Invariant**: 4-player turn order authoritative server-side only. No `Math.random()` added.

---

## ◈ FACE [3,W,0] — BUILD SYSTEM
> Vite + TypeScript alias resolution for out-of-tree workspaces.

### [3,W,1] VITE ALIAS CRITICAL RULES
- **Array form required** (not object) — ordering controls specificity
- **Regex exact-match for zustand**: `{ find: /^zustand$/, ... }` prevents prefix collision
  - `zustand/middleware`, `zustand/vanilla` etc. must resolve naturally via node_modules
  - Alias order: `/^zustand\/middleware$/` BEFORE `/^zustand$/`
- **nanoid**: must alias to `nanoid/index.browser.js` (not main) — node:crypto not browser-safe
- **@dimforge/rapier3d-compat**: add `optimizeDeps: { exclude: [...] }` to skip Vite pre-bundle

### [3,W,2] TRANSITIVE DEP RESOLUTION
Game-core packages have no local `node_modules`; transitive deps must be aliased via `frontend/node_modules`:
```
uuid          → ./node_modules/uuid/dist/index.js
eventemitter3 → ./node_modules/eventemitter3/index.mjs
nanoid        → ./node_modules/nanoid/index.browser.js
rapier3d      → ./node_modules/@dimforge/rapier3d-compat/rapier.mjs
```
Same paths in `tsconfig.json` `paths` (for tsc) and `vite.config.ts` `alias` (for bundler).

### [3,W,3] COOP/COEP HEADERS
Required in Vite dev server AND production (railway.toml):
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
Without these: `SharedArrayBuffer` unavailable → DSP worklets fail silently.

---

## ◈ FACE [3,E,0] — GOVERNANCE
> Constitutional agents and ledger obligations.

### [3,E,1] AGENT ROLES
| Agent | Role |
|---|---|
| **Viktor** | Epistemic Orchestrator — architecture design, phase ratification, workflow audit |
| **CodeRabbit** | Governor — veto authority on implementation, PASS/FAIL on PRs |
| **Local Tactician** | CI/infra — workflow files, action stubs, survivability gates |

**Veto-loop resolution precedent**: Viktor proposes; CodeRabbit vetoes with blockers; Viktor patches; CodeRabbit issues PASS.

### [3,E,2] LEDGER UPDATE OBLIGATION
`constitutional-governance.yml` CI enforces ledger updates on every PR:
- `/shared/project-memory.md` — chronological integration log
- `/governance/ledgers/viktor.md` — Viktor phase decisions
- `/governance/ledgers/coderabbit.md` — CodeRabbit PASS/FAIL record

### [3,E,3] CI WORKFLOWS
| Workflow | Gate |
|---|---|
| `constitutional-governance.yml` | Ledger updated on PR |
| `dsp-survivability.yml` | 12ms Tier 0 latency ceiling |
| `entropy-monitor.yml` | Daily architecture drift scan |
| `slack-notify.yml` | Push to main/dev → Slack notification |

---

## ◈ FACE [3,N,0] — KNOWN VIOLATIONS / RESIDUAL DEBT
> Active tracking. Not yet patched.

### [3,N,1] ACTIVE VIOLATIONS
| ID | Location | Issue | Priority |
|---|---|---|---|
| BV4 | `useFarkleGame.ts` | `Math.random()` in `_randomColumns()` for doubler placement | HIGH |
| RV1 | `RhythmEngine.ts` | 6 `Math.random()` calls in gameplay-visible paths | MEDIUM |
| BV5 | `farkle-shared/types.ts` | Exports old voxel EntityType constants (mirror/ghost/catalyst) | LOW |
| BV1 | `useFarkleGame.ts` | Coupled to `VoxelPhysicsSystem` — needs interface extraction before 2D port | MEDIUM |

### [3,N,2] RAPIER3D PRODUCTION CONCERNS
- 2.2MB WASM bundle — needs code-splitting before production deploy
- WASM async init → brief empty canvas on cold load (acceptable for beta)
- `optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] }` — required or Vite crashes

### [3,N,3] AUDIO INCOMPLETE
- NeonOscilloscope `AudioContext` singleton not enforced across route changes
- Offline spectral extraction pipeline (`scripts/extractGenome.ts`) not yet run
- `DiceDisplay` scoring mask is approximation — not face-level from scorer

---

## ◆ VERTEX [4,0,0] — FUTURE HORIZON
> Locked Director roadmap. Not yet built.

### [4,0,1] LATTICE OF 20 GENRES
All genre payout modifiers gated at `rtpGated: true` until 10k-session Monte Carlo validation per genre.
**Active in beta**: Horror, Roguelike, Casino, Match3, Rhythm (5/20 — experience effects only)
**Hard cap**: 4.0× multiplier absolute limit

### [4,0,2] PHASE ROADMAP (adabt-core)
| Phase | Status |
|---|---|
| Phase 0 | Workflow Audit ✓ |
| Phase 1 | Ring Buffer + WASM DSP Kernel ✓ |
| Phase 2 | First Sound (3-thread pipeline) ✓ |
| Phase 3 | IIR Filter + ERK Modulation |
| Phase 4 | Spectral Genome Extraction Pipeline |
| Phase 5–8 | Evolution, Reinforcement, Demand Intelligence, Multi-Agent |

### [4,0,3] ORGANIC VEGAS NEXT SPRINT
1. 4-player room support (see `shared/FOUR_PLAYER_PLAN.md`)
2. Spectral genome offline extraction from 23 FAR_NZY training MP3s
3. RTP Monte Carlo validation (10k sessions) per genre before multiplier unlock
4. `Math.random()` audit sweep: CI static check (grep for `Math.random` in gameplay paths)
5. NeonOscilloscope AudioContext singleton enforcement

---

## ◇ JUNCTION INDEX — CROSS-DOMAIN VERTICES

| Junction | Domains | Memory Nodes |
|---|---|---|
| ◇ A | Audio ↔ ERK ↔ Grid | [1,N,5] + [1,S,2] + [2,N,2] |
| ◇ B | CSPRNG ↔ Multiplayer ↔ Scoring | [0,0,3] + [2,S,1] + [0,0,2] |
| ◇ C | LITE/ELITE ↔ 3D Scene ↔ DSP Tier | [1,E,2] + [2,N,4] + [1,E,3] |
| ◇ D | Build ↔ Workspace ↔ TSConfig | [3,W,1] + [3,W,2] + [3,W,3] |
| ◇ E | Governance ↔ Ledgers ↔ CI | [3,E,1] + [3,E,2] + [3,E,3] |
| ◇ F | Sacred Core ↔ Conflict Resolution ↔ RTP | [0,0,1] + [2,N,3] + [4,0,1] |

---

*Lattice integrity maintained by Memory Continuity Law (Constitutional Law 4).*
*Next update required on: next merge to dream-core that mutates any Sacred Core path, ERK state list, or multiplayer protocol.*
