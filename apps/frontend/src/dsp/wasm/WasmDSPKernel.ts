/**
 * WasmDSPKernel.ts — TypeScript bridge: load .wasm, bind to SAB.
 *
 * This module is the SOLE interface between the WASM DSP kernel and the
 * rest of the TypeScript codebase.  It handles:
 *
 *   1. Loading and instantiating the dsp-kernel.wasm module.
 *   2. Mapping the SharedArrayBuffer into WASM linear memory.
 *   3. Providing a typed, lifecycle-safe API over the raw WASM exports.
 *   4. Enforcing the monotonic head pointer contract on the TS side.
 *
 * USAGE (inside a Web Worker):
 *
 *   const kernel = await WasmDSPKernel.create(128, 48000, 0);
 *   postMessage({
 *     sab:          kernel.sharedBuffer,
 *     writeHeadPtr: kernel.writeHeadPtr,
 *     readHeadPtr:  kernel.readHeadPtr,
 *     dataPtr:      kernel.dataPtr,
 *   });
 *   kernel.setFreq(440);
 *   kernel.setGain(0.5);
 *   const written = kernel.process(128);
 *   // ...
 *   kernel.dispose();
 *
 * CONSTRAINTS:
 *   - Must run in a Worker, NEVER on the main thread.
 *   - The Worker creates the WASM memory; the SAB is kernel.sharedBuffer.
 *     Do NOT pre-allocate a SAB externally — the WASM module owns it.
 *   - crossOriginIsolated must be true (COOP/COEP headers required).
 */

import type { DspKernelExports, DeviceTier } from './WasmDSPKernel.types';
import {
  KernelState,
  TIER_CAPACITY,
  DSP_BLOCK_SIZE,
  WASM_INITIAL_PAGES,
  WASM_MAX_PAGES,
} from './WasmDSPKernel.types';

/* ─── WASM Module URL ─────────────────────────────────────────────────────── */

/**
 * Resolve the .wasm file path relative to this module.
 * Vite / bundlers will handle the URL transformation.
 * For raw Worker usage, the .wasm must be co-located or the path overridden.
 */
const DEFAULT_WASM_URL = new URL('./dsp-kernel.wasm', import.meta.url).href;

/* ─── Bridge Class ────────────────────────────────────────────────────────── */

export class WasmDSPKernel {
  private readonly exports: DspKernelExports;
  private readonly statePtr: number;
  private readonly sab: SharedArrayBuffer;
  private readonly capacity: number;
  private readonly _writeHeadPtr: number;
  private readonly _readHeadPtr: number;
  private readonly _dataPtr: number;
  private lifecycle: KernelState;

  private constructor(
    exports: DspKernelExports,
    statePtr: number,
    sab: SharedArrayBuffer,
    capacity: number,
    writeHeadPtr: number,
    readHeadPtr: number,
    dataPtr: number,
  ) {
    this.exports = exports;
    this.statePtr = statePtr;
    this.sab = sab;
    this.capacity = capacity;
    this._writeHeadPtr = writeHeadPtr;
    this._readHeadPtr = readHeadPtr;
    this._dataPtr = dataPtr;
    this.lifecycle = KernelState.READY;
  }

  /* ─── Factory ─────────────────────────────────────────────────────────── */

  /**
   * Load the WASM module and initialize the DSP kernel.
   *
   * The WASM module owns the SharedArrayBuffer.  After create() resolves,
   * callers must retrieve `kernel.sharedBuffer` and transfer it to the
   * AudioWorklet via postMessage — do NOT allocate a separate SAB externally.
   *
   * The ring buffer storage (g_ring_headers, g_audio_data) is placed by the
   * linker in the WASM data/BSS segment.  After instantiation the bridge calls
   * dsp_write_head_ptr / dsp_read_head_ptr / dsp_data_ptr to learn the exact
   * byte offsets and exposes them via kernel.writeHeadPtr / readHeadPtr / dataPtr
   * for the AudioWorklet to attach typed-array views.
   *
   * @param capacity    Ring buffer capacity in samples (power of two, ≤ 16384).
   * @param sampleRate  Audio sample rate (e.g. 48000).
   * @param tier        Device tier — governs WASM page budget (default: 0).
   * @param wasmUrl     Override for the .wasm file location.
   * @returns           A ready-to-use WasmDSPKernel instance.
   * @throws            If crossOriginIsolated is false, capacity is invalid,
   *                    or WASM instantiation / init fails.
   */
  static async create(
    capacity: number,
    sampleRate: number,
    tier: DeviceTier = 0,
    wasmUrl: string = DEFAULT_WASM_URL,
  ): Promise<WasmDSPKernel> {
    /* ── Pre-flight checks ─────────────────────────────────────────────── */

    if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
      throw new Error(
        'WasmDSPKernel: crossOriginIsolated is false. ' +
        'COOP/COEP headers are required for SharedArrayBuffer.',
      );
    }

    if (capacity <= 0 || (capacity & (capacity - 1)) !== 0) {
      throw new RangeError(
        `WasmDSPKernel: capacity must be a power of two, got ${capacity}`,
      );
    }

    const initialPages = WASM_INITIAL_PAGES[tier];
    const maxPages = WASM_MAX_PAGES[tier];

    /* ── WASM memory — the sole owner of the SharedArrayBuffer ────────── */

    /*
     * The WebAssembly.Memory is created here with the tier-correct page
     * budget and shared: true (required for Atomics on the data region).
     * wasmMemory.buffer is a SharedArrayBuffer that the kernel writes into
     * directly.  The AudioWorklet must attach its views to THIS buffer —
     * there is no separate SAB; the two are the same object.
     */
    const wasmMemory = new WebAssembly.Memory({
      initial: initialPages,
      maximum: maxPages,
      shared: true,
    });

    /* ── Load & instantiate WASM ───────────────────────────────────────── */

    const wasmResponse = await fetch(wasmUrl);
    if (!wasmResponse.ok) {
      throw new Error(`WasmDSPKernel: failed to fetch WASM module: ${wasmResponse.status}`);
    }

    const wasmBytes = await wasmResponse.arrayBuffer();

    const { instance } = await WebAssembly.instantiate(wasmBytes, {
      env: {
        memory: wasmMemory,
      },
    });

    const exports = instance.exports as unknown as DspKernelExports;

    /* ── Initialize kernel state ───────────────────────────────────────── */

    const statePtr = exports.dsp_kernel_init(capacity, sampleRate);
    if (statePtr === 0) {
      throw new Error(
        'WasmDSPKernel: dsp_kernel_init() returned null. ' +
        `capacity=${capacity}, sampleRate=${sampleRate}`,
      );
    }

    /*
     * Retrieve the compiler-assigned addresses of the ring buffer regions.
     * These are byte offsets into wasmMemory.buffer (a SharedArrayBuffer).
     * The AudioWorklet receives (sharedBuffer, writeHeadPtr, readHeadPtr,
     * dataPtr, capacity) and constructs its typed-array views there.
     */
    const writeHeadPtr = exports.dsp_write_head_ptr();
    const readHeadPtr  = exports.dsp_read_head_ptr();
    const dataPtr      = exports.dsp_data_ptr();

    return new WasmDSPKernel(
      exports,
      statePtr,
      wasmMemory.buffer as SharedArrayBuffer,
      capacity,
      writeHeadPtr,
      readHeadPtr,
      dataPtr,
    );
  }

  /* ─── Tier Helper ─────────────────────────────────────────────────────── */

  /**
   * Create a kernel with tier-appropriate capacity and memory budget.
   */
  static async createForTier(
    tier: DeviceTier,
    sampleRate: number = 48000,
    wasmUrl?: string,
  ): Promise<WasmDSPKernel> {
    const capacity = TIER_CAPACITY[tier];
    return WasmDSPKernel.create(capacity, sampleRate, tier, wasmUrl);
  }

  /* ─── Hot Path ────────────────────────────────────────────────────────── */

  /**
   * Generate and push `frameCount` samples into the ring buffer.
   *
   * @param frameCount  Samples to generate (default: DSP_BLOCK_SIZE = 128).
   * @returns           Samples actually written (0 on back-pressure).
   * @throws            If the kernel has been disposed.
   */
  process(frameCount: number = DSP_BLOCK_SIZE): number {
    this.assertReady();
    this.lifecycle = KernelState.PROCESSING;

    const written = this.exports.dsp_kernel_process(this.statePtr, frameCount);

    this.lifecycle = KernelState.READY;
    return written;
  }

  /* ─── Parameter Control ───────────────────────────────────────────────── */

  /** Set oscillator frequency in Hz [20, 20000]. */
  setFreq(freq: number): void {
    this.assertReady();
    this.exports.dsp_kernel_set_freq(this.statePtr, freq);
  }

  /** Set output gain [0, 1]. */
  setGain(gain: number): void {
    this.assertReady();
    this.exports.dsp_kernel_set_gain(this.statePtr, gain);
  }

  /* ─── SAB / Pointer Access ───────────────────────────────────────────── */

  /**
   * The SharedArrayBuffer owned by this kernel's WASM memory.
   *
   * Pass this to the AudioWorklet via postMessage together with
   * writeHeadPtr, readHeadPtr, and dataPtr so the worklet can attach its
   * typed-array views at the correct positions:
   *
   *   const wh = new Int32Array(sab, kernel.writeHeadPtr, 1);
   *   const rh = new Int32Array(sab, kernel.readHeadPtr,  1);
   *   const d  = new Float32Array(sab, kernel.dataPtr, capacity);
   */
  get sharedBuffer(): SharedArrayBuffer {
    return this.sab;
  }

  /** WASM byte offset of WRITE_HEAD — use as byteOffset for Int32Array views. */
  get writeHeadPtr(): number {
    return this._writeHeadPtr;
  }

  /** WASM byte offset of READ_HEAD — use as byteOffset for Int32Array views. */
  get readHeadPtr(): number {
    return this._readHeadPtr;
  }

  /** WASM byte offset of the Float32 audio data region. */
  get dataPtr(): number {
    return this._dataPtr;
  }

  /* ─── Diagnostics ─────────────────────────────────────────────────────── */

  /** Cumulative overrun count (buffer-full rejections). */
  get overruns(): number {
    if (this.lifecycle === KernelState.DISPOSED) return 0;
    return this.exports.dsp_kernel_get_overruns(this.statePtr);
  }

  /** Total frames produced since init. */
  get framesProduced(): number {
    if (this.lifecycle === KernelState.DISPOSED) return 0;
    return this.exports.dsp_kernel_get_frames_produced(this.statePtr);
  }

  /** Current lifecycle state. */
  get state(): KernelState {
    return this.lifecycle;
  }

  /** Ring buffer capacity (samples). */
  get bufferCapacity(): number {
    return this.capacity;
  }

  /* ─── Lifecycle ───────────────────────────────────────────────────────── */

  /**
   * Tear down the WASM kernel and release all resources.
   *
   * After calling dispose():
   *   - The WASM state pointer is invalidated.
   *   - The WASM memory (and its SharedArrayBuffer) are released by the GC.
   *   - No further process/setFreq/setGain calls are allowed.
   *
   * Safe to call multiple times (idempotent).
   */
  dispose(): void {
    if (this.lifecycle === KernelState.DISPOSED) return;

    this.exports.dsp_kernel_teardown(this.statePtr);
    this.lifecycle = KernelState.DISPOSED;
  }

  /* ─── Internal ────────────────────────────────────────────────────────── */

  private assertReady(): void {
    if (this.lifecycle === KernelState.DISPOSED) {
      throw new Error('WasmDSPKernel: kernel has been disposed.');
    }
    if (this.lifecycle === KernelState.UNINITIALIZED) {
      throw new Error('WasmDSPKernel: kernel is not initialized. Use WasmDSPKernel.create().');
    }
    if (this.lifecycle === KernelState.ERROR) {
      throw new Error('WasmDSPKernel: kernel is in error state.');
    }
  }
}
