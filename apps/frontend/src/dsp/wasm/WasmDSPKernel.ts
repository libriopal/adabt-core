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
 *   const kernel = await WasmDSPKernel.create(sab, capacity, sampleRate);
 *   kernel.setFreq(440);
 *   kernel.setGain(0.5);
 *   const written = kernel.process(128);
 *   // ...
 *   kernel.dispose();
 *
 * CONSTRAINTS:
 *   - Must run in a Worker, NEVER on the main thread.
 *   - The SAB must already be allocated by the main thread (DSPController).
 *   - crossOriginIsolated must be true (COOP/COEP headers required).
 */

import type { DspKernelExports, DeviceTier } from './WasmDSPKernel.types';
import {
  KernelState,
  TIER_CAPACITY,
  TIER_MAX_MEMORY,
  SAB_HEADER_BYTES,
  DSP_BLOCK_SIZE,
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
  private lifecycle: KernelState;

  private constructor(
    exports: DspKernelExports,
    statePtr: number,
    sab: SharedArrayBuffer,
    capacity: number,
  ) {
    this.exports = exports;
    this.statePtr = statePtr;
    this.sab = sab;
    this.capacity = capacity;
    this.lifecycle = KernelState.READY;
  }

  /* ─── Factory ─────────────────────────────────────────────────────────── */

  /**
   * Load the WASM module and initialize the DSP kernel.
   *
   * @param sab         Pre-allocated SharedArrayBuffer (from DSPController).
   * @param capacity    Ring buffer capacity in samples (must match SAB size).
   * @param sampleRate  Audio sample rate (e.g. 48000).
   * @param wasmUrl     Override for the .wasm file location.
   * @returns           A ready-to-use WasmDSPKernel instance.
   * @throws            If crossOriginIsolated is false, capacity is invalid,
   *                    or WASM instantiation fails.
   */
  static async create(
    sab: SharedArrayBuffer,
    capacity: number,
    sampleRate: number,
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

    const expectedSabSize = SAB_HEADER_BYTES + capacity * Float32Array.BYTES_PER_ELEMENT;
    if (sab.byteLength !== expectedSabSize) {
      throw new RangeError(
        `WasmDSPKernel: SAB size mismatch. Expected ${expectedSabSize}, got ${sab.byteLength}.`,
      );
    }

    /* ── Load & instantiate WASM ───────────────────────────────────────── */

    const wasmResponse = await fetch(wasmUrl);
    if (!wasmResponse.ok) {
      throw new Error(`WasmDSPKernel: failed to fetch WASM module: ${wasmResponse.status}`);
    }

    const wasmBytes = await wasmResponse.arrayBuffer();

    /*
     * Import the SAB as WASM shared memory.
     *
     * The WASM module is compiled with SHARED_MEMORY=1, so its memory
     * import expects a WebAssembly.Memory backed by a SharedArrayBuffer.
     * We create a Memory object wrapping our SAB, giving the kernel
     * direct zero-copy access to the ring buffer data.
     *
     * NOTE: For Phase 1, the SAB IS the WASM memory.  The kernel writes
     * directly into the SAB's data region via pointer arithmetic.
     * In later phases, the kernel may use a separate WASM memory heap
     * and copy to the SAB — but for now, zero-copy is the contract.
     */
    const wasmMemory = new WebAssembly.Memory({
      initial: Math.ceil(expectedSabSize / 65536),  /* Pages (64KB each) */
      maximum: Math.ceil(expectedSabSize / 65536) + 1,
      shared: true,
    });

    /*
     * Copy the SAB content into WASM memory.
     * The headers (WRITE_HEAD, READ_HEAD) start at offset 0.
     * The data region starts at SAB_HEADER_BYTES.
     */
    const wasmBuffer = new Uint8Array(wasmMemory.buffer);
    const sabView = new Uint8Array(sab);
    wasmBuffer.set(sabView);

    const { instance } = await WebAssembly.instantiate(wasmBytes, {
      env: {
        memory: wasmMemory,
      },
    });

    const exports = instance.exports as unknown as DspKernelExports;

    /* ── Initialize kernel state ───────────────────────────────────────── */

    /*
     * sab_ptr = 0 because the SAB is mapped at the start of WASM memory.
     * The kernel uses this offset to locate the headers and data region.
     */
    const statePtr = exports.dsp_kernel_init(0, capacity, sampleRate);
    if (statePtr === 0) {
      throw new Error(
        'WasmDSPKernel: dsp_kernel_init() returned null. ' +
        `capacity=${capacity}, sampleRate=${sampleRate}`,
      );
    }

    return new WasmDSPKernel(exports, statePtr, sab, capacity);
  }

  /* ─── Tier Helper ─────────────────────────────────────────────────────── */

  /**
   * Create a kernel with tier-appropriate defaults.
   */
  static async createForTier(
    tier: DeviceTier,
    sab: SharedArrayBuffer,
    sampleRate: number = 48000,
    wasmUrl?: string,
  ): Promise<WasmDSPKernel> {
    const capacity = TIER_CAPACITY[tier];
    return WasmDSPKernel.create(sab, capacity, sampleRate, wasmUrl);
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
   *   - The SAB is NOT freed (owned by DSPController on the main thread).
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
