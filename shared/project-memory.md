- [CONSOLIDATION]: Integrated Hard-Failure Gate for COOP/COEP survivability. 
- [GOVERNANCE]: Resolved Veto-loop between Viktor and CodeRabbit regarding grep depth.
- [MEMORY CONSOLIDATED]: Local Tactician audit — created dsp-latency-audit/action.yml (was missing, hard-blocking CI); added COOP/COEP middleware to apps/backend/src/index.ts and vite.config.ts server.headers (headers were absent from runtime, only present as railway.toml comments).

## Topology Migration (Phase 1 Init)
- @*.md identity files -> governance/identity/
- Agent ledgers -> governance/ledgers/
- Constitution and shared/ paths unchanged.
- CI grep patterns updated for new ledger paths.

## Phase 1 Ring Buffer — Stub → Implementation (2026-05-14)
- [VETO RESOLVED]: CodeRabbit (Governor) vetoed stub-only DSP primitives; replaced with real implementations.
- `.github/actions/dsp-latency-audit/action.js` — rewritten as a real Node.js script: simulates 128-sample render loop at 48 kHz, measures mean/p99/max render time and jitter ratio against the 2.67 ms Tier 0 budget (10% jitter ceiling). Was: a 4-line stub with undefined `jitter` variable.
- `apps/frontend/src/dsp/SPSC_RING_BUFFER_SPEC.md` — created; documents acquire/release memory ordering protocol for WASM Worker (producer) → AudioWorklet (consumer) SPSC ring buffer.
- `apps/frontend/src/dsp/SharedRingBuffer.ts` — created; lock-free SPSC ring buffer over SharedArrayBuffer. Capacity 2048 samples (power-of-two). `push()` uses release store on WRITE_HEAD; `pull()` uses acquire load on WRITE_HEAD. Both methods provide overrun/underrun protection. Exposes `fromSharedArrayBuffer()` for cross-thread attachment and diagnostics (`availableSamples`, `freeSamples`).

## Phase 1 Ring Buffer — Blocker Patch (2026-05-14)
- [VETO PATCH]: Three CodeRabbit blockers resolved to clear the Phase 1 veto.
- `SharedRingBuffer.ts` — **Monotonic Indexing**: WRITE_HEAD and READ_HEAD are now ever-increasing uint32 values; the power-of-two mask is applied only at `data[]` access (`index & (capacity-1)`). Distance arithmetic uses unsigned subtraction (`>>> 0`) with no mask, making full (distance == capacity) and empty (distance == 0) mathematically distinct. Previous masked-subtraction approach produced aliasing between those two states.
- `action.js` — **Dependency-Free CI**: Removed `@actions/core` entirely. Output uses `process.stdout.write` with GitHub workflow command syntax (`::error::`, `::notice::`). Runs in any lean Node.js environment without node_modules.
- `action.js` — **Absolute Jitter Gate**: Replaced ratio-based jitter `(max-mean)/mean` with absolute jitter `max - mean`; fails if > 1.0 ms. Ratio metric was numerically unstable when mean approaches zero on fast Android hardware (Tier 0 target).

## Phase 1 Ring Buffer — Spec Correction / Governor [PASS] (2026-05-14)
- [PASS]: CodeRabbit (Governor) issued a PASS on the Phase 1 implementation with one final note.
- `SPSC_RING_BUFFER_SPEC.md` — **Spec brought into sync with monotonic implementation**: Removed all masked-head pseudocode. Producer and consumer examples now show `(write - read) >>> 0` for distance (no mask), `& (N-1)` only at `data[]` access, and `>>> 0` (not `& mask`) on the `Atomics.store` head advance. Added a dedicated "Monotonic Index Strategy" section explaining why unsigned subtraction eliminates the full/empty aliasing that masked subtraction produced. Invariants table updated to document the index strategy and the `[0..N]` distance range explicitly.

## Phase 1 WASM DSP Kernel — Scaffold (2026-05-14)
- [SCAFFOLD]: WASM DSP Kernel bridge committed to apps/frontend/src/dsp/wasm/.
- C source (dsp-kernel.c/h): Sine oscillator + one-pole IIR smoothing. Writes to SAB via monotonic WRITE_HEAD (release store). Zero allocations in hot path. Bump allocator for state — no malloc.
- Emscripten build (build.sh): Tier-adaptive. Tier 0: 256KB initial, 1MB max, no SIMD. Tier 3+: SIMD enabled, 16MB ceiling.
- TS bridge (WasmDSPKernel.ts): Factory async create(), typed exports contract, lifecycle state machine (UNINITIALIZED -> READY -> PROCESSING -> DISPOSED). SAB size validation, crossOriginIsolated gate.
- Types (WasmDSPKernel.types.ts): Tier capacity/memory maps, SAB layout constants, KernelState enum.
- Tests (wasm-kernel.test.ts): Monotonic head correctness, full/empty distinction, wrap-around, underrun silence, capacity validation.
- Monotonic contract: C kernel uses uint32 wrap-safe arithmetic for head distance; mask applied only at data[] access. Matches SharedRingBuffer.ts and SPSC_RING_BUFFER_SPEC.md.

## Phase 1 WASM DSP Kernel — Memory Ownership Fix (2026-05-14)
- [BUG FIX]: Two structural bugs patched in WasmDSPKernel.ts factory (identified in post-scaffold audit).
- **Memory ownership (was: External SAB → now: WASM-Owned SAB)**: The factory no longer accepts an externally-created SharedArrayBuffer. Instead, `WebAssembly.Memory` is created inside `create()` with the correct tier page budget; `wasmMemory.buffer` (which IS the SharedArrayBuffer) is exposed via `kernel.sharedBuffer`. The AudioWorklet must receive this buffer via postMessage — not a separately-allocated SAB. The old approach produced a detached copy: the WASM kernel wrote samples into `wasmMemory.buffer` while the worklet read from an unrelated buffer, meaning no audio ever flowed.
- **WASM memory sizing (was: 1 page → now: tier-correct pages)**: `WASM_INITIAL_PAGES` and `WASM_MAX_PAGES` maps added to types (matching build.sh). Tier 0: 4 pages initial / 16 pages max. Tier 3–4: 16 pages / 256 pages. Previously `Math.ceil(sabSize / 65536)` gave 1 page for Tier 0 — below the module's 4-page minimum — causing `WebAssembly.instantiate` to throw before the kernel ever ran.
- **Ring buffer placement (superseded)**: An intermediate step used `WASM_SAB_OFFSET = 32768` passed as `sab_ptr` to `dsp_kernel_init()`. This was replaced in the same session by compiler-placed storage (see next section).
- **Factory signature change**: `create(sab, capacity, sampleRate, url?)` → `create(capacity, sampleRate, tier?, url?)`. `createForTier(tier, sab, sampleRate?)` → `createForTier(tier, sampleRate?, url?)`. No external callers existed at time of change.

## Phase 1 WASM DSP Kernel — Compiler-Placed Storage / Pointer Fix (2026-05-14)
- [BUG FIX]: Eliminated the manual `sab_ptr` offset and replaced it with compiler-managed static storage in the WASM data/BSS segment.
- **Root cause of the collision risk**: Passing `sab_ptr = 0` (or any hand-computed offset) to `dsp_kernel_init()` meant the TS bridge was responsible for ensuring the ring buffer didn't overlap the module's own stack, static data, or bump heap. Any miscalculation caused silent corruption with no trap.
- **Fix — C side**: `g_ring_headers[2]` (two adjacent `volatile uint32_t`) and `g_audio_data[DSP_MAX_CAPACITY]` declared as `static` globals in `dsp-kernel.c`. The linker assigns their addresses inside the WASM data/BSS segment; the compiler guarantees no overlap with the stack or bump heap. `dsp_kernel_init(sab_ptr, capacity, sr)` → `dsp_kernel_init(capacity, sr)` — no offset argument. `state->headers = g_ring_headers; state->data = g_audio_data`.
- **Fix — pointer exports**: Three new WASM exports added: `dsp_write_head_ptr()`, `dsp_read_head_ptr()`, `dsp_data_ptr()` — each returns `(uint32_t)(uintptr_t)` of the respective global. The TS bridge calls these once after `dsp_kernel_init()` and stores the values. The AudioWorklet constructs its typed-array views as `new Int32Array(sab, writeHeadPtr, 1)` / `new Float32Array(sab, dataPtr, capacity)`.
- **Fix — TS side**: `WASM_SAB_OFFSET` removed from types. `WasmDSPKernel` stores `_writeHeadPtr`, `_readHeadPtr`, `_dataPtr`; exposes them via `kernel.writeHeadPtr`, `kernel.readHeadPtr`, `kernel.dataPtr`. `sharedBuffer` accessor retained. `ringBufferOffset` single accessor replaced by the three precise getters.
- **Header constant rename**: `SAB_WRITE_HEAD_OFFSET` / `SAB_READ_HEAD_OFFSET` → `SAB_WRITE_HEAD_IDX` / `SAB_READ_HEAD_IDX` (array indices, not byte offsets). `SAB_HEADER_BYTES` / `SAB_HEADER_INTS` removed from C header (now internal detail of the static layout).
- **build.sh**: `_dsp_write_head_ptr`, `_dsp_read_head_ptr`, `_dsp_data_ptr` added to `EXPORTED_FUNCTIONS`.

## Phase 1 WASM DSP Kernel — Consumer-Side WASM SAB Adapter (2026-05-14)
- [BRIDGE COMPLETE]: SharedRingBuffer.fromWasmMemory() added as the consumer-side counterpart to WasmDSPKernel's producer-side pointer exports.
- **Problem**: SharedRingBuffer.fromSharedArrayBuffer() assumes WRITE_HEAD at byte 0 and data at byte 8. With WASM-owned memory, the linker places g_ring_headers and g_audio_data at arbitrary addresses in the data/BSS segment. The old factory would attach views at the wrong offsets — reading heap/stack bytes instead of ring buffer data.
- **Fix — fromWasmMemory(sab, writeHeadPtr, readHeadPtr, dataPtr, capacity)**: New static factory accepts the exact byte offsets returned by the WASM kernel's pointer-getter exports. Constructs Uint32Array(sab, writeHeadPtr, 2) for headers and Float32Array(sab, dataPtr, capacity) for data. The AudioWorklet processor receives these offsets via postMessage and calls fromWasmMemory() to build a pull-side ring view that reads the exact bytes the C kernel writes. True zero-copy consumer path.
- **Safety checks**: 4-byte alignment on all three pointers (Uint32/Float32 view requirement). Contiguity assertion: readHeadPtr == writeHeadPtr + 4 (g_ring_headers is a 2-element array). Bounds check: data region must fit within sab.byteLength. Capacity must be power-of-two.
- **Backward compatible**: fromSharedArrayBuffer() unchanged; standalone (non-WASM) usage unaffected.

## Phase 2 — "First Sound" Milestone (2026-05-14)
- [FIRST-SOUND]: Full 3-thread audio pipeline scaffolded: Main Thread (DSPNode) → Web Worker (dsp-worker.ts, owns WASM kernel) → AudioWorklet (dsp-worklet-processor.ts, pipes to hardware).
- **C kernel DSP fix**: Removed Phase 1 IIR one-pole smoothing from hot path. The 0.995 coefficient (fc ≈ 38 Hz) attenuated a 440 Hz sine by ≈ -21 dB — inaudible. Phase 2 outputs clean sine × gain directly. IIR state retained for Phase 3.
- **AudioWorkletProcessor** (dsp-worklet-processor.ts): Self-contained (zero imports, required for AudioWorkletGlobalScope). Inline ring buffer consumer with Atomics acquire/relaxed semantics. Receives SAB + WASM pointer offsets via MessagePort init message. 128-sample block pull, mono → multi-channel copy, periodic underrun reporting.
- **DSP Worker** (dsp-worker.ts): Creates WasmDSPKernel instance on init. 5 ms setInterval production loop fills ring buffer with 128-sample blocks until back-pressure (process() returns 0). Handles control messages: setFrequency, setGain, getDiagnostics, stop.
- **DSPNode** (DSPNode.ts): Main-thread orchestrator. start() creates AudioContext (48 kHz, interactive latency), loads worklet module via addModule(), spawns Worker, waits for WASM kernel ready, wires SAB to worklet, connects to destination. stop() gracefully tears down all three threads with 2s Worker timeout. State machine: idle → starting → running → stopping → idle.
- **Message type contracts**: Worker and Worklet inbound/outbound message types added to WasmDSPKernel.types.ts for type-safe postMessage boundaries.
- **TS compilation fixes**: Pre-existing strict-mode errors in SharedRingBuffer (private field casts) and WasmDSPKernel (ArrayBuffer→SAB cast) resolved. Clean `tsc --noEmit` pass.
- **Tests**: 37 total (22 Phase 1 + 15 Phase 2). New tests cover: clean sine amplitude/frequency correctness, IIR bypass verification, push→pull pipeline data integrity, continuous produce/consume cycles (1000 iterations), frequency change detection via zero-crossings, WASM SAB integration path at non-zero offsets, Worker/Worklet message type contracts.

## Audio Recovery & UI Pivot — Sandbox Tier 0 (2026-05-14)
- [AUDIT]: dsp-kernel.c confirmed: `gain = 0.5f` in `dsp_kernel_init`. No change needed.
- [FIX — WORKLET STEREO]: `dsp-worklet-processor.ts` updated. `process()` now explicitly maps mono ring pull into `outputs[0][0]` (Left) and copies to `outputs[0][1]` (Right) via `outputs[0][ch].set(left)` loop. Added `console.warn` after 50 consecutive underruns; added all-zero output detection with `port.postMessage({ type: 'warn', ... })`. `DSPNode.ts` updated: `outputChannelCount: [1]` → `[2]`.
- [FIX — AUDIO CONTEXT RESUME]: `AGROSLayout.tsx` `handleStart` now calls `await actx.resume()` immediately after `new AudioContext(...)` before `addModule()`. Inline `WORKLET_SRC` blob worklet updated to match: copies Left → Right channel, logs underrun streak via `console.warn` at 60 consecutive misses.
- [FIX — DIAGNOSTICS]: Worker `onmessage` handler in `handleStart` changed from checking `'tick'` (never sent) to `'diagnostics'` (sent by worker in response to `getDiagnostics`). `setInterval` added to send `{ type: 'getDiagnostics' }` every 200ms; cleared on stop. Separate `useEffect` polls SAB Atomics for WR_HEAD/RD_HEAD at 100ms for status strip.
- [REFACTOR — OSCILLOSCOPE]: Inline canvas + `drawScope` removed from `AGROSLayout`. New standalone `src/components/Oscilloscope.tsx`: reads from `useDSP().sabViews` via a mutable ref (RAF closure always sees latest SAB), neon cyan `#00ffff` on black, phosphor persistence (`rgba(0,0,0,0.82)` fade), zero-crossing trigger, double-pass bloom (wide glow pass + bright 1.5px center line, `shadowBlur: 14`), RMS bar, "NO SIGNAL" warning when buffer is all-zeros.
- [REFACTOR — SLOTGEN REMOVED]: `apps/frontend/src/pages/SlotGen.tsx` deleted. Nav updated. Default route `/` now serves `RhythmEngine`.
- [SINGLETON — RhythmEngine.ts]: `src/engine/RhythmEngine.ts` created as an exported singleton. Owns ALL game state and audio modulation. Exposes: `init({ setFreq, setGain })`, `setActive(bool)`, `reset()`, `update(dt, now)`, `tryPointerCatch(px, py)`, `snapshot()`. Audio is fully decoupled — the singleton calls `setFreq(modulatedFreq)` each tick; the React page only calls `update()` and renders.
- [EMOTION MATH — LERP GLIDE]: α = 0.05. Each tick: `currentFreq += 0.05 * (targetFreq - currentFreq)`. Models string tension — frequency changes feel weighted, not instant.
- [EMOTION MATH — LFO + ANTICIPATION]: LFO phase advances at `escalatedRate = lfoRate × e^(0.5 × normSpeed)` where `normSpeed = (blockSpeed - 55) / 120`. As blocks fall faster, vibrato tightens exponentially (k = 0.5). Modulated freq = `currentFreq + lfoAmplitude × sin(2π × lfoPhase)` clamped to [20, 20000].
- [EMOTION MATH — TENSION STATE (MISS)]: `lfoAmplitude = 15–20 Hz` (nervous vibrato), `lfoRate = 8–12 Hz` (flutter), `targetFreq = currentFreq × 2^(12/1200)` (+12 cents microtonal dissonance).
- [EMOTION MATH — FLOW STATE (≥3 PERFECT CATCHES)]: `lfoAmplitude = 2 Hz` (subtle breathing), `lfoRate = 0.5 Hz` (slow oscillation), `targetFreq` snaps to nearest Perfect Fifth (× 1.5) or Octave (× 2) of the caught block's frequency.
- [PAGE — RhythmEngine.tsx]: Rewritten as pure renderer. Reads `RhythmEngine.blocks`, `health`, `score`, `emotion`, `currentFreq`; draws to canvas each RAF frame. Frequency axis Y-scale is logarithmic (top=1800Hz, bottom=60Hz). Current-frequency line changes color per emotion state (cyan=neutral, green=flow, red=tension). Block catch triggers burst ring animation.

## Audio Bug Fix + RhythmEngine Game (2026-05-14)
- [BUG FIX]: 4 silent message-protocol violations in AGROSLayout.tsx fixed; audio now flows.
- **Bug 1 — missing capacity**: `init` message lacked `capacity` field → WASM received `0` → `dsp_kernel_init` returned null → silent engine failure. Fix: `capacity: TIER_CAPACITY[tier]` added.
- **Bug 2 — NaN gain**: `{ type: 'setGain', gain: 0.5 }` sent but worker reads `msg.value` → `undefined` → NaN propagated through every sample → silence. Fix: `{ type: 'setGain', value: v }`.
- **Bug 3 — type mismatch on setFreq**: AGROSLayout sent `'setFreq'` but worker handles `case 'setFrequency'`. Silently ignored. Fix: renamed to `'setFrequency'` with `value` property.
- **Bug 4 — stop mismatch**: AGROSLayout sent `'dispose'` but worker handles `'stop'`. Worker never tore down. Fixed.
- [UI REFACTOR]: SlotGen/Casino removed from nav and routing. "Rhythm Engine" replaces it as the default route at `/`.
- [OSCILLOSCOPE UPGRADE]: `drawScope` in AGROSLayout upgraded to neon-glow with phosphor persistence (semi-transparent clear), zero-crossing trigger detection for stable waveform, double-pass rendering (wide bloom + bright center line, shadowBlur 12).
- [DSP CONTEXT]: `src/dsp/DSPContext.tsx` created — exports `useDSP()` hook providing `{ setFreq, setGain, running, sabViews }`. AGROSLayout wraps all children in `DSPContext.Provider`.
- [GAME]: `src/pages/RhythmEngine.tsx` — Inverted Guitar Hero. WASM kernel plays continuous sine tone. Frequency-modulator nodes fall top-to-bottom on a log frequency axis (top=1800Hz, bottom=60Hz). Player catches them to keep tone alive. Health drives gain (0%=silence); missed blocks drain health, caught blocks restore it. Uses `useDSP()` to call `setFreq`/`setGain` on the shared kernel.

## DSP Control Board UI (2026-05-14)
- [UI]: AGROSLayout redesigned as a persistent audio control surface; AudioTestBench and dsp-kernel.worker.ts added.
- **AGROSLayout.tsx** (apps/frontend/src/components/AGROSLayout.tsx): Root shell now hosts the full audio engine (Worker + AudioWorklet) so it persists across route changes. Layout zones: top nav bar (44px, AGROS logo + route links + status LED + tier selector + Start/Stop), `<Outlet />` content area (flex-1), control surface (≈172px), status strip (28px). Control surface contains: oscilloscope canvas (292×108, 60fps RAF loop), SVG rotary knobs for FREQ and GAIN, and 8 emotional state pads (one per canonical state, color-coded).
- **Rotary knobs**: SVG-based, 270° arc sweep SW→N→SE (225°→495° clock). Drag-up-to-increase interaction; touch-aware. Groove fills cyan proportional to value. Disabled-greyed when engine is stopped.
- **Oscilloscope**: Peeks at last 512 samples before WRITE_HEAD directly from the SAB using `Atomics.load` — no consumer pointer advance. RMS level meter bar rendered at canvas bottom (turns red above 0.45 RMS).
- **Status strip**: WRITE_HEAD and READ_HEAD displayed as 8-digit hex, plus available samples, overrun count (red when > 0), frames produced, tier.
- **AudioWorklet processor**: Inlined as a Blob URL in both AGROSLayout and AudioTestBench — no separate worklet file, avoids Vite worklet config requirements.
- **dsp-kernel.worker.ts** (apps/frontend/src/dsp/dsp-kernel.worker.ts): Web Worker host for WasmDSPKernel. Calls `process(128)` every 2ms (back-pressure prevents overflow). Posts `{ type: 'ready', sab, writeHeadPtr, readHeadPtr, dataPtr, capacity }` on init. Posts `{ type: 'tick', overruns, framesProduced }` every 100ms. Handles setFreq, setGain, dispose messages.
- **AudioTestBench.tsx** (apps/frontend/src/components/AudioTestBench.tsx): Standalone dev harness with identical engine wiring. Includes frequency/gain sliders, oscilloscope canvas, and full diagnostics grid. Useful for isolated testing without the full layout shell.
- **Emotional state pads**: Visual-only selector for all 8 canonical states (Dread, Suspense, Escalation, Catastrophic Release, Mourning, Recovery, Silence, Ritualistic Build). Each pad has a distinct color. DSP mapping is deferred to a future phase.

## Dream Core Branch Goal (2026-05-15)
- [BRANCH]: `dream-core` is the FAR_NZY-to-adabt-core migration lane for a unified Dream Core runtime.
- [DESIGN HIERARCHY]: The dominant genre order is Horror, Roguelike, Casino, Match-3, then Rhythm.
- [PRODUCT GOAL]: The game should feel like it is generating and modulating music, not simply playing music behind a Farkle clone.
- [GOVERNANCE]: Dream Core systems should remain wrapper-level mechanics around the Sacred Core so RTP, scorer math, and authoritative randomness stay intact.

## Dream Core Audit Lock + Beta Handoff (2026-05-15)
- [AUDIT LOCK]: Commit `2989002` (`fix(dream-core): audit-lock ultimate rerolls`) locked `packages/dream-core/src/genres/moba.ts` so `ultimateRerollLoop` consumes exactly one authoritative roll and reports the reroll path as blocked with `RTP_WRAPPER_ONLY_NO_REROLL`.
- [BALANCE]: The Rogue-like `CARDSHARP` free-turn loop risk was nerfed so the branch cannot grow into a free-Farkle extra-roll exploit.
- [INTEGRATION]: Dream Core frontend/backend integration was repaired enough for clean branch builds without changing Sacred Core scorer files in that follow-up audit commit.
- [VERIFICATION]: The audit sweep passed `npm run build`, the 16-case `packages/farkle-engine/src/farkleScorer.test.ts` regression suite, an explicit `ultimateRerollLoop` single-call probe, and `git diff --check`.
- [PERFORMANCE RULE]: Dream Core visualization paths must preserve the existing requirement that the Neon Oscilloscope stays on a `requestAnimationFrame` canvas path rather than per-sample React re-renders.
- [HANDOFF]: A Claude-ready hardening brief for cloning, auditing, fixing, and pushing Dream Core toward a production-grade beta is stored in `/shared/cc-prompt.md`.

## Dream Core Dual-Repo Claude Handoff (2026-05-15)
- [HANDOFF UPDATE]: `/shared/cc-prompt.md` now instructs Claude to clone `libriopal/FAR_NZY` first into `core/`, clone `libriopal/adabt-core` `dream-core` into `dream/`, treat `core/` as source material and `dream/` as the target repo, run read-only discovery, ask exactly ten clarifying questions before mutating merge work, then integrate the two into a production-beta Dream Core and audit/fix the result.

## Organic Vegas Director Answers (2026-05-15)
- [ROUTE]: Organic Vegas should stay with the current route posture; do not make it a total `/` replacement unless explicitly approved later.
- [VALUE GOVERNANCE]: All 20 genres may modify payout only after the relevant fusion passes Monte Carlo/RTP validation.
- [TIERING]: Android/mobile and desktop must auto-toggle LITE/ELITE graphics and sound by hardware capability; mobile must also fit and wrap the screen automatically.
- [AUDIO DATA]: Training MP3s should become extracted spectral genome JSON artifacts rather than raw runtime MP3 assets.
- [MULTIPLAYER]: Production-beta targets 2-player WebSocket multiplayer on day one, with an explicit plan for up to 4 players the following week.

## Organic Vegas Integration — Phase 1 (2026-05-15)
- [INTEGRATION]: FAR_NZY dual-repo merge into dream-core branch as Project Organic Vegas.
- [ARCH]: `packages/game-core` copied from FAR_NZY; aliased in vite.config.ts + tsconfig as @match3d/game-core. Three.js + @dimforge/rapier3d-compat installed in frontend.
- [SCENE]: `apps/frontend/src/components/game/OrganicVegasScene.tsx` — Three.js canvas with Rapier3D physics. LITE/ELITE shader tiers. Bio-Architectural iridescent die materials with bone-gold filigree lattice. Collision impulse events emitted to DreamAudioEngine ERK pipeline.
- [HARDWARE]: `apps/frontend/src/utils/hardwareTier.ts` — auto-detects LITE/ELITE quality; Tier 0–4 DSP tier; mobile screen-wrap flag.
- [CSPRNG FIX]: `apps/frontend/src/components/game/DreamApp.tsx` — replaced hardcoded mock dice with `seededRng` (deterministic xorshift, crypto-entropy seeded). `scoreFarkle` from Sacred Core evaluates every roll. Scores live in UI state.
- [GAME PAGE]: `apps/frontend/src/pages/OrganicVegas.tsx` — full roll→score→bank loop. Life-Force system (FAR_NZY energy adapted as wrapper). `resolveModifiers` from Conflict Resolution Layer applied post-score (all RTP-gated in beta = multiplier stays 1.0).
- [LOBBY]: `apps/frontend/src/pages/OrganicVegasLobby.tsx` — 2-player room create/join UI. Crypto-random room codes. Error and waiting states.
- [MULTIPLAYER]: `apps/frontend/src/hooks/useOrganicMultiplayer.ts` — WebSocket hook. Symbolic replication only (seeds + scores, no frame data). 2-player cap enforced.
- [BACKEND WS]: `apps/backend/src/index.ts` — WebSocket server added via ws.Server on /ws path. Room registry. `GameRoom` wired per connection. Math.random in error debugId replaced with crypto.getRandomValues.
- [ROUTES]: `apps/frontend/src/App.tsx` — `/organic-vegas` (lobby) and `/organic-vegas/game` (game) added as parallel routes. Existing AGROS routes untouched.
- [CONFLICT RESOLUTION]: `packages/dream-core/src/conflictResolution.ts` — priority-ordered genre modifier layer. All score multipliers RTP-gated (rtpGated=true) until 10k-session Monte Carlo validation. Hard multiplier cap 4.0.
- [NEURAL CONDUCTOR]: `apps/frontend/src/audio/spectralGenome.ts` — SpectralGenome schema + fallback genomes (manual approximation of FAR_NZY training audio). Runtime fetches /spectral-genome/*.json; falls back to hardcoded until offline extraction pipeline runs.
- [CSS]: `apps/frontend/src/styles/organic-vegas.css` — Bio-Architectural Dark Casino design tokens + layout primitives.
- [4-PLAYER PLAN]: `shared/FOUR_PLAYER_PLAN.md` — concrete next-sprint plan for 4-player expansion.
- [GOVERNANCE]: Sacred Core untouched. `ultimateRerollLoop` audit lock verified intact. No Math.random in gameplay paths (static check pending build).

## TITAN Rebuild — Phase 1.0 (2026-05-15)
- [BALANCE]: FAR_NZY `levels.ts` LevelDef spawn weights rebalanced — bomb/rainbow_bomb/ice/lock/stone capped at ≤1 across all 10 levels. Entities now function as rare "Infection" events; redistributed weight to die/wild/catalyst.
- [INPUT]: `VoxelPileScene.tsx` — EntityMesh groups expose `userData` (bodyId, face, column, chainable). SceneContent adds group-level `onPointerMove` fallback walker so chain-extend fires reliably on fast mobile drags. Resolves 6-die chain pointer-capture collision.
- [FAUCET ECONOMY]: `FarkleHUD.tsx` — `VitalityDripPanel` (animated life-force vial, PRIME regen drip / FRENZY bleed, rate label) and `ShardFaucetPanel` (5-diamond milestone tracker at 20k-pt intervals, partial fill bar) added to main HUD overlay.
- [NEURAL CONDUCTOR]: `gameAudio.ts` synced to dream-core — `playBombCollapse` (necrotic sawtooth + resonant bandpass noise), `playCollisionImpact` (physics velocity magnitude → pitched impact, 25ms rate-limit), `startHeroJourneyTheme` / `stopHeroJourneyTheme` (6-stem A-minor pentatonic ambient pads). Detune jitter on `playChainAdd` prevents phase cancellation under simultaneous die collisions.
- [WIRING]: `useGameAudio.ts` — subscribes to `explosionStore` for bomb-collapse trigger; tracks body position deltas per tick for collision impulse estimation; hero journey starts/stops with game phase transitions.
- [GOVERNANCE]: Sacred Core (farkleStore.ts, gameStore.ts, useFarkleGame.ts, types.ts) untouched.
