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
