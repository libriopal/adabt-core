/**
 * WasmDSPKernel.types.ts — Typed WASM exports contract.
 *
 * This file defines the exact shape of the WASM module's exported functions
 * as seen from TypeScript after instantiation.  It is the single source of
 * truth for the TS ↔ WASM boundary — any mismatch between this contract and
 * dsp-kernel.h is a build-breaking bug.
 *
 * All pointer types are `number` (WASM i32 linear-memory offsets).
 * All sizes are in samples (not bytes) unless otherwise noted.
 */

/* ─── WASM Export Signatures ──────────────────────────────────────────────── */

/**
 * Raw WASM module exports.  These are the functions compiled from dsp-kernel.c,
 * accessible after `WebAssembly.instantiate()`.
 */
export interface DspKernelExports {
  /** WASM linear memory (shared with the SAB when imported). */
  readonly memory: WebAssembly.Memory;

  /**
   * Initialize the DSP kernel state.
   * Ring buffer storage is compiler-placed; no sab_ptr argument needed.
   * Call dsp_write_head_ptr / dsp_read_head_ptr / dsp_data_ptr after this
   * to retrieve byte offsets for typed-array view attachment.
   *
   * @param capacity    Ring buffer capacity in samples (power of two, ≤ DSP_MAX_CAPACITY).
   * @param sampleRate  Audio sample rate (e.g. 48000).
   * @returns           Pointer (i32) to DspKernelState, or 0 on failure.
   */
  dsp_kernel_init(capacity: number, sampleRate: number): number;

  /**
   * Return the WASM byte offset of WRITE_HEAD (g_ring_headers[0]).
   * Use as byteOffset when constructing Int32Array views for Atomics.
   */
  dsp_write_head_ptr(): number;

  /** Return the WASM byte offset of READ_HEAD (g_ring_headers[1]). */
  dsp_read_head_ptr(): number;

  /** Return the WASM byte offset of the Float32 audio data region. */
  dsp_data_ptr(): number;

  /**
   * Generate and push `frameCount` samples into the ring buffer.
   * Hot path — zero allocations, no blocking.
   *
   * @param statePtr    Pointer from dsp_kernel_init().
   * @param frameCount  Number of samples to generate (clamped to DSP_BLOCK_SIZE).
   * @returns           Number of samples actually written (0 on back-pressure).
   */
  dsp_kernel_process(statePtr: number, frameCount: number): number;

  /**
   * Set the oscillator frequency.
   * @param statePtr  Kernel state pointer.
   * @param freq      Frequency in Hz [20, 20000].
   */
  dsp_kernel_set_freq(statePtr: number, freq: number): void;

  /**
   * Set the output gain.
   * @param statePtr  Kernel state pointer.
   * @param gain      Gain in [0, 1].
   */
  dsp_kernel_set_gain(statePtr: number, gain: number): void;

  /**
   * Get cumulative overrun count (back-pressure events).
   * @returns  Number of push() rejections since init.
   */
  dsp_kernel_get_overruns(statePtr: number): number;

  /**
   * Get total frames produced since init.
   */
  dsp_kernel_get_frames_produced(statePtr: number): number;

  /**
   * Tear down the kernel and release WASM-side allocations.
   * After this call, statePtr is invalid.
   */
  dsp_kernel_teardown(statePtr: number): void;
}

/* ─── Tier Configuration ──────────────────────────────────────────────────── */

/** Device tier (mirrors TierDetector classification). */
export type DeviceTier = 0 | 1 | 2 | 3 | 4;

/** Tier-indexed ring buffer capacity. */
export const TIER_CAPACITY: Record<DeviceTier, number> = {
  0: 128,
  1: 512,
  2: 2048,
  3: 8192,
  4: 16384,
} as const;

/** Tier-indexed WASM memory ceiling (bytes). */
export const TIER_MAX_MEMORY: Record<DeviceTier, number> = {
  0: 1 * 1024 * 1024,    //  1 MB
  1: 1 * 1024 * 1024,    //  1 MB
  2: 4 * 1024 * 1024,    //  4 MB
  3: 16 * 1024 * 1024,   // 16 MB
  4: 16 * 1024 * 1024,   // 16 MB
} as const;

/* ─── SAB Layout Constants (must match dsp-kernel.h) ─────────────────────── */

/** Number of Uint32 header slots before the Float32 data region. */
export const SAB_HEADER_INTS = 2;

/** Byte offset where Float32 data begins in the SAB. */
export const SAB_HEADER_BYTES = 8;

/** AudioWorklet render quantum (fixed by Web Audio spec). */
export const DSP_BLOCK_SIZE = 128;

/* ─── WASM Memory Layout ──────────────────────────────────────────────────── */

/**
 * Tier-indexed WASM initial page count (1 page = 65536 bytes).
 * Must match the INITIAL_MEMORY values in build.sh.
 */
export const WASM_INITIAL_PAGES: Record<DeviceTier, number> = {
  0: 4,   // 256 KB
  1: 4,   // 256 KB
  2: 8,   // 512 KB
  3: 16,  // 1 MB
  4: 16,  // 1 MB
} as const;

/**
 * Tier-indexed WASM maximum page count.
 * Must match the MAXIMUM_MEMORY values in build.sh.
 */
export const WASM_MAX_PAGES: Record<DeviceTier, number> = {
  0: 16,   // 1 MB
  1: 16,   // 1 MB
  2: 64,   // 4 MB
  3: 256,  // 16 MB
  4: 256,  // 16 MB
} as const;

/* ─── Worker ↔ Main Thread Messages (Phase 2) ────────────────────────────── */

/** Messages sent from the main thread to the DSP Worker. */
export type WorkerInboundMessage =
  | { type: 'init'; capacity: number; sampleRate: number; tier?: DeviceTier; wasmUrl?: string }
  | { type: 'setFrequency'; value: number }
  | { type: 'setGain'; value: number }
  | { type: 'getDiagnostics' }
  | { type: 'stop' };

/** Messages sent from the DSP Worker to the main thread. */
export type WorkerOutboundMessage =
  | { type: 'ready'; sab: SharedArrayBuffer; writeHeadPtr: number; readHeadPtr: number; dataPtr: number; capacity: number }
  | { type: 'diagnostics'; framesProduced: number; overruns: number; state: number }
  | { type: 'stopped' }
  | { type: 'error'; message: string };

/** Messages sent from the main thread to the AudioWorklet processor. */
export type WorkletInboundMessage =
  | { type: 'init'; sab: SharedArrayBuffer; writeHeadPtr: number; readHeadPtr: number; dataPtr: number; capacity: number }
  | { type: 'stop' };

/** Messages sent from the AudioWorklet processor to the main thread. */
export type WorkletOutboundMessage =
  | { type: 'ready' }
  | { type: 'underrun'; count: number }
  | { type: 'error'; message: string };

/* ─── Kernel Lifecycle States ─────────────────────────────────────────────── */

export const enum KernelState {
  /** Not yet initialized. */
  UNINITIALIZED = 0,
  /** init() succeeded; ready to process. */
  READY = 1,
  /** Currently processing (guard against re-entrant calls). */
  PROCESSING = 2,
  /** teardown() called; pointer is invalid. */
  DISPOSED = 3,
  /** init() failed (bad capacity, OOM, etc). */
  ERROR = 4,
}
