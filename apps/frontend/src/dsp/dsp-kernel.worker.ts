/**
 * dsp-kernel.worker.ts — Web Worker host for WasmDSPKernel.
 *
 * The kernel MUST run in a Worker (never on the main thread) because:
 *   - WebAssembly.instantiate() is blocking-capable
 *   - The process() loop must not jank the UI thread
 *
 * Protocol:
 *   Main → Worker:  { type: 'init', sampleRate: number, tier: 0|1|2|3|4 }
 *                   { type: 'setFreq', freq: number }
 *                   { type: 'setGain', gain: number }
 *                   { type: 'dispose' }
 *
 *   Worker → Main:  { type: 'ready', sab, writeHeadPtr, readHeadPtr, dataPtr, capacity }
 *                   { type: 'tick', overruns, framesProduced }
 *                   { type: 'error', message }
 */

import { WasmDSPKernel } from './wasm/WasmDSPKernel';
import type { DeviceTier } from './wasm/WasmDSPKernel.types';

let kernel: WasmDSPKernel | null = null;
let processInterval: ReturnType<typeof setInterval> | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init': {
      const { sampleRate, tier } = msg as { type: 'init'; sampleRate: number; tier: DeviceTier };
      try {
        kernel = await WasmDSPKernel.createForTier(tier, sampleRate);

        self.postMessage({
          type: 'ready',
          sab: kernel.sharedBuffer,
          writeHeadPtr: kernel.writeHeadPtr,
          readHeadPtr: kernel.readHeadPtr,
          dataPtr: kernel.dataPtr,
          capacity: kernel.bufferCapacity,
        });

        // Feed the ring buffer at ~2x the consumption rate; back-pressure handles overflow.
        processInterval = setInterval(() => {
          kernel?.process(128);
        }, 2);

        // Post diagnostics to the main thread every 100ms.
        tickInterval = setInterval(() => {
          if (!kernel) return;
          self.postMessage({
            type: 'tick',
            overruns: kernel.overruns,
            framesProduced: kernel.framesProduced,
          });
        }, 100);
      } catch (err) {
        self.postMessage({ type: 'error', message: String(err) });
      }
      break;
    }

    case 'setFreq': {
      kernel?.setFreq((msg as { type: 'setFreq'; freq: number }).freq);
      break;
    }

    case 'setGain': {
      kernel?.setGain((msg as { type: 'setGain'; gain: number }).gain);
      break;
    }

    case 'dispose': {
      if (processInterval != null) clearInterval(processInterval);
      if (tickInterval != null) clearInterval(tickInterval);
      kernel?.dispose();
      kernel = null;
      break;
    }
  }
};
