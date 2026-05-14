# Viktor — Epistemic Orchestrator Ledger

## Phase 0 — Workflow Audit (2026-05-14)
- Audited .github/workflows/: 3 CRITICAL, 2 HIGH, 4 MEDIUM findings.
- Proposed corrected slack-notify.yml with COOP/COEP survivability gate.
- Governor-approved after iterative VETO resolution.

## Phase 1 — Topology Ratification (2026-05-14)
- Ratified governance topology: @*.md -> governance/identity/, ledgers -> governance/ledgers/.
- Amendments: constitution paths, CI grep patterns, CLAUDE.md exemption.

## Phase 1 — Ring Buffer Architecture (2026-05-14)
- Designed SPSC lock-free ring buffer over SharedArrayBuffer.
- Memory layout: 8-byte header (WRITE_HEAD, READ_HEAD) + Float32 data region.
- Tier-adaptive capacity: 128 (Tier 0) -> 16384 (Tier 4).
- Governor-approved after monotonic index patch (full/empty aliasing fix).

## Phase 1 — WASM DSP Kernel Scaffold (2026-05-14)
- Scaffolded apps/frontend/src/dsp/wasm/ (7 files).
- C kernel: sine oscillator + IIR smoothing, monotonic head pointers, zero-alloc hot path.
- TS bridge: async WASM loader, typed exports, lifecycle state machine.
- Build: Emscripten, tier-adaptive flags (Tier 0: 256KB/1MB, no SIMD).
- Tests: monotonic head contract, wrap-around, underrun, capacity validation.

## Phase 1 — WASM Memory Ownership Bridge (2026-05-14)
- Sovereign fixed: C kernel now owns memory layout (static g_ring_headers/g_audio_data in BSS).
- Bridge (WasmDSPKernel.ts) updated: creates WebAssembly.Memory with tier-correct pages,
  retrieves exported byte offsets via dsp_write_head_ptr/dsp_read_head_ptr/dsp_data_ptr,
  exposes them as kernel.writeHeadPtr/readHeadPtr/dataPtr for AudioWorklet view attachment.
- Added SharedRingBuffer.fromWasmMemory() — consumer-side adapter for WASM-owned SAB.
  Accepts arbitrary byte offsets (not hard-coded 0/8), validates alignment (4-byte),
  header contiguity (readHeadPtr == writeHeadPtr + 4), and SAB bounds. Allows
  AudioWorklet to construct typed-array views at the exact linker-assigned addresses.
- 8 new tests: WASM SAB attachment, raw Atomics interop, push/pull at non-zero offsets,
  alignment rejection, contiguity rejection, capacity validation, bounds rejection.
- Total test count: 22 (up from 14).

## Phase 2 — "First Sound" Milestone (2026-05-14)
- **C kernel fix**: Removed IIR one-pole smoothing (coeff 0.995, fc ≈ 38 Hz) from the
  hot path — it attenuated the 440 Hz sine by ≈ -21 dB, making "First Sound" inaudible.
  DSP pipeline is now: sinf(2π × phase) × gain → ring buffer. IIR state (z1[]) retained
  in DspKernelState for Phase 3 filter work.
- **AudioWorkletProcessor** (dsp-worklet-processor.ts): Self-contained (no imports).
  Receives SAB + pointer offsets via MessagePort. Inline ring buffer pull with
  Atomics acquire/relaxed semantics. Mono → multi-channel copy. Underrun reporting.
- **DSP Worker** (dsp-worker.ts): Owns WasmDSPKernel instance. 5 ms timer-driven
  production loop (fills ring buffer via process(128) until back-pressure). Handles
  setFrequency, setGain, getDiagnostics, stop messages from main thread.
- **DSPNode** (DSPNode.ts): Main-thread controller orchestrating 3 threads.
  Creates AudioContext → loads worklet module → spawns Worker → wires SAB → connects
  to hardware output. Exposes setFrequency(), setGain(), start(), stop().
  State machine: idle → starting → running → stopping → idle. Callbacks for state
  changes, underruns, errors. Clean teardown with 2s Worker timeout.
- **Type contracts**: WorkerInboundMessage, WorkerOutboundMessage, WorkletInboundMessage,
  WorkletOutboundMessage added to WasmDSPKernel.types.ts.
- **AudioWorklet type declarations** (worklet-global.d.ts): Minimal AudioWorkletGlobalScope
  types for tsc.
- **TS fixes**: Pre-existing strict-mode errors resolved — SharedRingBuffer private field
  casts now use `as unknown as`, WasmDSPKernel ArrayBuffer→SAB cast fixed.
- **Tests**: 15 new Phase 2 tests (37 total): clean sine amplitude, IIR bypass verification,
  zero-crossing frequency validation, push→pull pipeline, underrun handling, continuous
  produce/consume cycles, frequency change mid-stream, gain control, WASM SAB integration
  path, message type contracts, tier capacity sanity.
