/**
 * phase2-first-sound.test.ts — Phase 2 "First Sound" milestone tests.
 *
 * Tests cover:
 *   1. Clean sine oscillator output (no IIR attenuation)
 *   2. Worklet-style pull integration: push → pull pipeline
 *   3. Frequency change via setFrequency pattern
 *   4. Gain control
 *   5. Worker/Worklet message type contracts
 *   6. DSPNode option defaults
 *
 * These tests simulate the WASM kernel's DSP pipeline in pure TS using
 * the SharedRingBuffer as both producer and consumer.  Full end-to-end
 * WASM → AudioWorklet tests require a browser environment.
 *
 * Run:  npx vitest run apps/frontend/src/dsp/wasm/__tests__/phase2-first-sound.test.ts
 */

import { describe, it, expect } from 'vitest';
import { SharedRingBuffer } from '../../SharedRingBuffer';
import { DSP_BLOCK_SIZE, TIER_CAPACITY } from '../WasmDSPKernel.types';
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  WorkletInboundMessage,
  WorkletOutboundMessage,
} from '../WasmDSPKernel.types';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Generate a pure sine wave block (mimics dsp-kernel.c Phase 2 output).
 * Phase 2 DSP pipeline: sinf(2π × phase) × gain — no IIR smoothing.
 */
function generateSineBlock(
  blockSize: number,
  frequency: number,
  sampleRate: number,
  startPhase: number,
  gain: number,
): { samples: Float32Array; endPhase: number } {
  const samples = new Float32Array(blockSize);
  const phaseInc = frequency / sampleRate;
  let phase = startPhase;

  for (let i = 0; i < blockSize; i++) {
    samples[i] = Math.sin(2 * Math.PI * phase) * gain;
    phase += phaseInc;
    if (phase >= 1.0) phase -= 1.0;
  }

  return { samples, endPhase: phase };
}

/* ─── Clean Sine Output Tests ─────────────────────────────────────────────── */

describe('Phase 2 — Clean Sine Oscillator (no IIR)', () => {
  it('should produce a 440Hz sine at 0.5 gain with correct amplitude', () => {
    const { samples } = generateSineBlock(128, 440, 48000, 0, 0.5);

    // Peak amplitude should be close to gain (0.5)
    let maxAbs = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > maxAbs) maxAbs = abs;
    }

    // With 128 samples at 440Hz/48kHz, the sine completes ~1.17 cycles.
    // Peak should approach gain value (0.5), within rounding.
    expect(maxAbs).toBeGreaterThan(0.45);
    expect(maxAbs).toBeLessThanOrEqual(0.5);
  });

  it('should NOT attenuate 440Hz (Phase 1 IIR bug fix verification)', () => {
    // Phase 1 IIR (coeff=0.995) attenuated 440Hz by ~-21dB → ~0.087 * gain
    // Phase 2 should output sine * gain directly.
    const gain = 0.5;
    const { samples } = generateSineBlock(1024, 440, 48000, 0, gain);

    // Find peak
    let maxAbs = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > maxAbs) maxAbs = Math.abs(samples[i]);
    }

    // Must be at least 90% of gain (clean sine), not the ~8.7% the IIR produced.
    expect(maxAbs).toBeGreaterThan(gain * 0.9);
  });

  it('should produce zero-crossings consistent with 440Hz at 48kHz', () => {
    const sampleRate = 48000;
    const frequency = 440;
    const numSamples = 4096;
    const { samples } = generateSineBlock(numSamples, frequency, sampleRate, 0, 1.0);

    // Count positive-going zero crossings
    let crossings = 0;
    for (let i = 1; i < numSamples; i++) {
      if (samples[i - 1] <= 0 && samples[i] > 0) crossings++;
    }

    // Expected: ~(numSamples / sampleRate) × frequency cycles
    const expectedCycles = (numSamples / sampleRate) * frequency;
    expect(crossings).toBeGreaterThanOrEqual(Math.floor(expectedCycles) - 1);
    expect(crossings).toBeLessThanOrEqual(Math.ceil(expectedCycles) + 1);
  });
});

/* ─── Push → Pull Pipeline (Simulated Worklet) ───────────────────────────── */

describe('Phase 2 — Push → Pull Pipeline', () => {
  it('should deliver clean sine through ring buffer without data loss', () => {
    const ring = new SharedRingBuffer(2048);
    const frequency = 440;
    const sampleRate = 48000;
    const gain = 0.5;
    const blockSize = DSP_BLOCK_SIZE;

    // Simulate producer: generate and push 4 blocks
    let phase = 0;
    for (let block = 0; block < 4; block++) {
      const { samples, endPhase } = generateSineBlock(
        blockSize, frequency, sampleRate, phase, gain,
      );
      phase = endPhase;
      expect(ring.push(samples)).toBe(true);
    }

    expect(ring.availableSamples).toBe(4 * blockSize);

    // Simulate consumer (AudioWorklet): pull all 4 blocks
    const allOutput = new Float32Array(4 * blockSize);
    for (let block = 0; block < 4; block++) {
      const output = new Float32Array(blockSize);
      expect(ring.pull(output, blockSize)).toBe(true);
      allOutput.set(output, block * blockSize);
    }

    // Verify the pulled data matches a continuous sine
    const { samples: expected } = generateSineBlock(
      4 * blockSize, frequency, sampleRate, 0, gain,
    );
    for (let i = 0; i < expected.length; i++) {
      expect(allOutput[i]).toBeCloseTo(expected[i], 5);
    }
  });

  it('should handle underrun gracefully (silence fill)', () => {
    const ring = new SharedRingBuffer(2048);
    const output = new Float32Array(128);
    output.fill(999); // Dirty

    // Pull from empty ring — underrun
    expect(ring.pull(output, 128)).toBe(false);

    // Output should be silence
    for (let i = 0; i < 128; i++) {
      expect(output[i]).toBe(0);
    }
  });

  it('should survive continuous produce/consume cycles (simulated real-time)', () => {
    const ring = new SharedRingBuffer(512);
    const frequency = 440;
    const sampleRate = 48000;
    const gain = 0.5;
    const blockSize = DSP_BLOCK_SIZE;

    let producerPhase = 0;
    let consumerSampleCount = 0;

    // Simulate 1000 cycles of produce → consume
    for (let cycle = 0; cycle < 1000; cycle++) {
      // Producer: push 1 block
      const { samples, endPhase } = generateSineBlock(
        blockSize, frequency, sampleRate, producerPhase, gain,
      );
      producerPhase = endPhase;

      if (ring.push(samples)) {
        // Consumer: pull 1 block
        const output = new Float32Array(blockSize);
        if (ring.pull(output, blockSize)) {
          consumerSampleCount += blockSize;
          // Spot-check: samples should be within [-gain, +gain]
          for (let i = 0; i < blockSize; i++) {
            expect(Math.abs(output[i])).toBeLessThanOrEqual(gain + 1e-6);
          }
        }
      }
    }

    // Should have consumed most of the produced samples
    expect(consumerSampleCount).toBe(1000 * blockSize);
  });
});

/* ─── Frequency Control ───────────────────────────────────────────────────── */

describe('Phase 2 — setFrequency / setGain Control', () => {
  it('should change pitch when frequency changes mid-stream', () => {
    const ring = new SharedRingBuffer(2048);
    const sampleRate = 48000;
    const gain = 0.5;
    const blockSize = DSP_BLOCK_SIZE;

    // Phase 1: 440 Hz
    let phase = 0;
    const { samples: block440, endPhase } = generateSineBlock(
      blockSize, 440, sampleRate, phase, gain,
    );
    phase = endPhase;
    ring.push(block440);

    // Phase 2: 880 Hz (setFrequency called between blocks)
    const { samples: block880 } = generateSineBlock(
      blockSize, 880, sampleRate, phase, gain,
    );
    ring.push(block880);

    // Pull both blocks
    const out1 = new Float32Array(blockSize);
    const out2 = new Float32Array(blockSize);
    ring.pull(out1, blockSize);
    ring.pull(out2, blockSize);

    // Count zero-crossings in each block to verify frequency change
    function zeroCrossings(buf: Float32Array): number {
      let count = 0;
      for (let i = 1; i < buf.length; i++) {
        if ((buf[i - 1] <= 0 && buf[i] > 0) || (buf[i - 1] >= 0 && buf[i] < 0)) {
          count++;
        }
      }
      return count;
    }

    const cross1 = zeroCrossings(out1);
    const cross2 = zeroCrossings(out2);

    // 880 Hz should have roughly twice the crossings of 440 Hz
    expect(cross2).toBeGreaterThan(cross1 * 1.5);
  });

  it('should change amplitude when gain changes', () => {
    const sampleRate = 48000;

    const { samples: loud } = generateSineBlock(128, 440, sampleRate, 0, 1.0);
    const { samples: quiet } = generateSineBlock(128, 440, sampleRate, 0, 0.1);

    const maxLoud = Math.max(...Array.from(loud).map(Math.abs));
    const maxQuiet = Math.max(...Array.from(quiet).map(Math.abs));

    expect(maxLoud).toBeGreaterThan(maxQuiet * 5);
  });
});

/* ─── WASM SAB Integration Path ───────────────────────────────────────────── */

describe('Phase 2 — WASM SAB Integration Path (fromWasmMemory)', () => {
  it('should complete the full producer → ring → consumer path at WASM offsets', () => {
    // Simulate WASM-owned SAB with non-zero offsets
    const WRITE_HEAD_PTR = 16384;
    const READ_HEAD_PTR  = 16388;
    const DATA_PTR       = 16392;
    const CAPACITY       = 512;

    const totalBytes = DATA_PTR + CAPACITY * 4;
    const sab = new SharedArrayBuffer(totalBytes);

    // Consumer attaches via fromWasmMemory
    const ring = SharedRingBuffer.fromWasmMemory(
      sab, WRITE_HEAD_PTR, READ_HEAD_PTR, DATA_PTR, CAPACITY,
    );

    // Simulate producer: write sine data directly into SAB (like WASM kernel)
    const rawHeaders = new Int32Array(sab, WRITE_HEAD_PTR, 2);
    const rawData    = new Float32Array(sab, DATA_PTR, CAPACITY);

    const frequency = 440;
    const sampleRate = 48000;
    const gain = 0.5;
    const phaseInc = frequency / sampleRate;
    let phase = 0;

    // Write 4 × 128-sample blocks
    for (let block = 0; block < 4; block++) {
      const writeHead = Atomics.load(rawHeaders, 0);
      const readHead  = Atomics.load(rawHeaders, 1);
      const used = (writeHead - readHead) >>> 0;
      const free = CAPACITY - used;

      expect(free).toBeGreaterThanOrEqual(128);

      for (let i = 0; i < 128; i++) {
        rawData[(writeHead + i) & (CAPACITY - 1)] = Math.sin(2 * Math.PI * phase) * gain;
        phase += phaseInc;
        if (phase >= 1.0) phase -= 1.0;
      }

      Atomics.store(rawHeaders, 0, (writeHead + 128) >>> 0);
    }

    // Consumer pulls all 4 blocks via SharedRingBuffer
    expect(ring.availableSamples).toBe(512);

    const output = new Float32Array(128);
    for (let block = 0; block < 4; block++) {
      expect(ring.pull(output, 128)).toBe(true);
      // Verify samples are within [-gain, +gain]
      for (let i = 0; i < 128; i++) {
        expect(Math.abs(output[i])).toBeLessThanOrEqual(gain + 1e-6);
      }
    }

    expect(ring.availableSamples).toBe(0);
  });
});

/* ─── Message Type Contracts ──────────────────────────────────────────────── */

describe('Phase 2 — Worker/Worklet Message Types', () => {
  it('WorkerInboundMessage types should be exhaustive', () => {
    // Compile-time contract validation — these must type-check.
    const msgs: WorkerInboundMessage[] = [
      { type: 'init', capacity: 2048, sampleRate: 48000 },
      { type: 'init', capacity: 128, sampleRate: 48000, tier: 0, wasmUrl: '/dsp.wasm' },
      { type: 'setFrequency', value: 880 },
      { type: 'setGain', value: 0.3 },
      { type: 'getDiagnostics' },
      { type: 'stop' },
    ];
    expect(msgs.length).toBe(6);
  });

  it('WorkerOutboundMessage types should be exhaustive', () => {
    const sab = new SharedArrayBuffer(8);
    const msgs: WorkerOutboundMessage[] = [
      { type: 'ready', sab, writeHeadPtr: 0, readHeadPtr: 4, dataPtr: 8, capacity: 128 },
      { type: 'diagnostics', framesProduced: 1000, overruns: 0, state: 1 },
      { type: 'stopped' },
      { type: 'error', message: 'test error' },
    ];
    expect(msgs.length).toBe(4);
  });

  it('WorkletInboundMessage types should be exhaustive', () => {
    const sab = new SharedArrayBuffer(8);
    const msgs: WorkletInboundMessage[] = [
      { type: 'init', sab, writeHeadPtr: 0, readHeadPtr: 4, dataPtr: 8, capacity: 128 },
      { type: 'stop' },
    ];
    expect(msgs.length).toBe(2);
  });

  it('WorkletOutboundMessage types should be exhaustive', () => {
    const msgs: WorkletOutboundMessage[] = [
      { type: 'ready' },
      { type: 'underrun', count: 5 },
      { type: 'error', message: 'test' },
    ];
    expect(msgs.length).toBe(3);
  });
});

/* ─── Tier Capacity Sanity ────────────────────────────────────────────────── */

describe('Phase 2 — DSPNode defaults', () => {
  it('Tier 0 capacity should be 128 (matches DSP_BLOCK_SIZE)', () => {
    expect(TIER_CAPACITY[0]).toBe(DSP_BLOCK_SIZE);
  });

  it('all tier capacities should be ≥ DSP_BLOCK_SIZE', () => {
    for (const [, cap] of Object.entries(TIER_CAPACITY)) {
      expect(cap).toBeGreaterThanOrEqual(DSP_BLOCK_SIZE);
    }
  });
});
