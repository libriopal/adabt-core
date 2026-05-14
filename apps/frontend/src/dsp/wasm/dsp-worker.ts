/**
 * dsp-worker.ts — Web Worker: WASM DSP kernel producer.
 *
 * Owns the WasmDSPKernel instance.  Runs a continuous production loop
 * that fills the ring buffer with audio samples.  Receives control
 * messages (setFrequency, setGain, stop) from the main thread.
 *
 * LIFECYCLE:
 *   1. Main thread sends { type: 'init', capacity, sampleRate, tier }.
 *   2. Worker creates WasmDSPKernel, responds with { type: 'ready', sab, ... }.
 *   3. Worker starts production loop — fills ring buffer at ~5 ms intervals.
 *   4. Main thread sends control messages; worker forwards to WASM kernel.
 *   5. Main thread sends { type: 'stop' }; worker tears down kernel.
 *
 * PRODUCTION STRATEGY:
 *   Timer-based (setInterval ~5 ms). Each tick, push as many 128-sample
 *   blocks as the ring buffer has space for.  This keeps the buffer
 *   continuously topped up without busy-waiting.  The ring buffer's
 *   built-in back-pressure (process() returns 0 when full) prevents
 *   overwrite — safe even if the timer fires faster than consumption.
 */

import { WasmDSPKernel } from './WasmDSPKernel';
import type { DeviceTier } from './WasmDSPKernel.types';
import { DSP_BLOCK_SIZE } from './WasmDSPKernel.types';

/* ─── State ───────────────────────────────────────────────────────────────── */

let kernel: WasmDSPKernel | null = null;
let productionTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Production tick: fill the ring buffer with as many 128-sample blocks
 * as will fit.  Stops when the ring buffer is full (process() returns 0).
 *
 * At 48 kHz with 128-sample blocks, each block = ~2.67 ms of audio.
 * A 2048-sample buffer holds ~42.7 ms — the 5 ms tick interval means
 * we'll produce ~2 blocks per tick on average, with room for jitter.
 */
function productionTick(): void {
  if (!kernel) return;

  // Fill the buffer: push blocks until full or we've done a reasonable amount.
  // Max iterations = capacity / blockSize to prevent infinite loops.
  const maxBlocks = Math.ceil(kernel.bufferCapacity / DSP_BLOCK_SIZE);
  for (let i = 0; i < maxBlocks; i++) {
    const written = kernel.process(DSP_BLOCK_SIZE);
    if (written === 0) break; // Ring buffer full — back-pressure
  }
}

/* ─── Message Handler ─────────────────────────────────────────────────────── */

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data;

  switch (msg.type) {
    /* ── Init: create kernel, start production ──────────────────────── */
    case 'init': {
      try {
        const {
          capacity,
          sampleRate,
          tier = 0 as DeviceTier,
          wasmUrl,
        } = msg;

        // Create the WASM kernel — this allocates the SharedArrayBuffer.
        kernel = await WasmDSPKernel.create(
          capacity,
          sampleRate,
          tier,
          wasmUrl,
        );

        // Respond with the SAB and pointer offsets for the AudioWorklet.
        self.postMessage({
          type: 'ready',
          sab:          kernel.sharedBuffer,
          writeHeadPtr: kernel.writeHeadPtr,
          readHeadPtr:  kernel.readHeadPtr,
          dataPtr:      kernel.dataPtr,
          capacity:     kernel.bufferCapacity,
        });

        // Start production loop.
        // 5 ms interval — aggressive enough to keep the buffer topped up
        // on Tier 0 (128-sample = ~2.67 ms quantum), but not so tight
        // that it burns CPU.  Back-pressure in process() prevents overrun.
        productionTimer = setInterval(productionTick, 5);
      } catch (err) {
        self.postMessage({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    /* ── Frequency control ──────────────────────────────────────────── */
    case 'setFrequency': {
      if (kernel) {
        kernel.setFreq(msg.value);
      }
      break;
    }

    /* ── Gain control ───────────────────────────────────────────────── */
    case 'setGain': {
      if (kernel) {
        kernel.setGain(msg.value);
      }
      break;
    }

    /* ── Diagnostics ────────────────────────────────────────────────── */
    case 'getDiagnostics': {
      if (kernel) {
        self.postMessage({
          type: 'diagnostics',
          framesProduced: kernel.framesProduced,
          overruns:       kernel.overruns,
          state:          kernel.state,
        });
      }
      break;
    }

    /* ── Stop: teardown kernel, halt production ─────────────────────── */
    case 'stop': {
      if (productionTimer !== null) {
        clearInterval(productionTimer);
        productionTimer = null;
      }
      if (kernel) {
        kernel.dispose();
        kernel = null;
      }
      self.postMessage({ type: 'stopped' });
      break;
    }

    default:
      break;
  }
};
