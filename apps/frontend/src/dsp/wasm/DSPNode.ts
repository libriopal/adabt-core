/**
 * DSPNode.ts — Main-thread controller for the WASM DSP audio pipeline.
 *
 * Orchestrates three threads:
 *   1. Main thread (this file) — owns AudioContext, exposes API.
 *   2. Web Worker (dsp-worker.ts) — owns WasmDSPKernel, produces samples.
 *   3. AudioWorklet thread (dsp-worklet-processor.ts) — consumes samples,
 *      pipes to hardware output.
 *
 * USAGE:
 *   const dsp = new DSPNode();
 *   await dsp.start();            // "First Sound" — 440 Hz sine
 *   dsp.setFrequency(880);        // Main-thread → Worker → WASM kernel
 *   dsp.setGain(0.3);
 *   await dsp.stop();             // Clean teardown
 *
 * CONSTRAINTS:
 *   - crossOriginIsolated must be true (COOP/COEP required for SAB).
 *   - AudioContext may require a user gesture to resume (browser policy).
 *   - The WASM module (.wasm) must be accessible via the fetch URL.
 */

import type { DeviceTier } from './WasmDSPKernel.types';
import { TIER_CAPACITY, DSP_BLOCK_SIZE } from './WasmDSPKernel.types';

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type DSPNodeState = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

export interface DSPNodeOptions {
  /** Device tier — governs ring buffer capacity and WASM memory budget. */
  tier?: DeviceTier;
  /** Audio sample rate. Default: 48000 Hz. */
  sampleRate?: number;
  /** Initial oscillator frequency in Hz. Default: 440 (A4). */
  frequency?: number;
  /** Initial output gain [0, 1]. Default: 0.5. */
  gain?: number;
  /** Override URL for the .wasm file. */
  wasmUrl?: string;
  /** Callback for state changes. */
  onStateChange?: (state: DSPNodeState) => void;
  /** Callback for underrun reports from the AudioWorklet. */
  onUnderrun?: (count: number) => void;
  /** Callback for errors. */
  onError?: (message: string) => void;
}

/* ─── DSPNode Class ───────────────────────────────────────────────────────── */

export class DSPNode {
  private state: DSPNodeState = 'idle';
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private worker: Worker | null = null;
  private readonly options: Required<Omit<DSPNodeOptions, 'onStateChange' | 'onUnderrun' | 'onError'>>;
  private readonly callbacks: Pick<DSPNodeOptions, 'onStateChange' | 'onUnderrun' | 'onError'>;

  constructor(options: DSPNodeOptions = {}) {
    this.options = {
      tier: options.tier ?? 0,
      sampleRate: options.sampleRate ?? 48000,
      frequency: options.frequency ?? 440,
      gain: options.gain ?? 0.5,
      wasmUrl: options.wasmUrl ?? '',
    };
    this.callbacks = {
      onStateChange: options.onStateChange,
      onUnderrun: options.onUnderrun,
      onError: options.onError,
    };
  }

  /* ─── Public API ──────────────────────────────────────────────────────── */

  /**
   * Start the audio pipeline: Worker + WASM kernel + AudioWorklet.
   *
   * 1. Creates AudioContext (may need user gesture to resume).
   * 2. Loads the AudioWorklet processor module.
   * 3. Spawns the Worker, which creates the WASM kernel.
   * 4. Wires the SAB between Worker and Worklet.
   * 5. Connects the AudioWorkletNode to the audio output.
   *
   * @throws If crossOriginIsolated is false, or any initialization step fails.
   */
  async start(): Promise<void> {
    if (this.state === 'running' || this.state === 'starting') return;

    this.setState('starting');

    try {
      /* ── 1. Pre-flight ─────────────────────────────────────────────── */

      if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
        throw new Error(
          'DSPNode: crossOriginIsolated is false. COOP/COEP headers required.',
        );
      }

      /* ── 2. AudioContext ───────────────────────────────────────────── */

      this.audioContext = new AudioContext({
        sampleRate: this.options.sampleRate,
        latencyHint: 'interactive',
      });

      // Resume if suspended (browser autoplay policy).
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      /* ── 3. Load AudioWorklet module ───────────────────────────────── */

      const workletUrl = new URL(
        './dsp-worklet-processor.ts',
        import.meta.url,
      ).href;

      await this.audioContext.audioWorklet.addModule(workletUrl);

      /* ── 4. Create AudioWorkletNode ────────────────────────────────── */

      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'dsp-worklet-processor',
        {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2], // Stereo: ch0=Left, ch1=Right (mono → duplicated)
        },
      );

      // Listen for worklet messages (ready, underrun, error).
      this.workletNode.port.onmessage = (event) => {
        const msg = event.data;
        switch (msg.type) {
          case 'ready':
            break; // Worklet attached to SAB successfully
          case 'underrun':
            this.callbacks.onUnderrun?.(msg.count);
            break;
          case 'error':
            this.handleError(`Worklet error: ${msg.message}`);
            break;
        }
      };

      /* ── 5. Spawn Worker ───────────────────────────────────────────── */

      const workerUrl = new URL('./dsp-worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });

      // Wait for the Worker to create the kernel and return the SAB.
      const workerReady = new Promise<{
        sab: SharedArrayBuffer;
        writeHeadPtr: number;
        readHeadPtr: number;
        dataPtr: number;
        capacity: number;
      }>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          const msg = event.data;
          if (msg.type === 'ready') {
            this.worker!.removeEventListener('message', handler);
            resolve(msg);
          } else if (msg.type === 'error') {
            this.worker!.removeEventListener('message', handler);
            reject(new Error(msg.message));
          }
        };
        this.worker!.addEventListener('message', handler);
      });

      const capacity = TIER_CAPACITY[this.options.tier];

      // Tell the worker to initialize the WASM kernel.
      this.worker.postMessage({
        type: 'init',
        capacity,
        sampleRate: this.options.sampleRate,
        tier: this.options.tier,
        ...(this.options.wasmUrl ? { wasmUrl: this.options.wasmUrl } : {}),
      });

      const { sab, writeHeadPtr, readHeadPtr, dataPtr } = await workerReady;

      /* ── 6. Wire SAB to AudioWorklet ───────────────────────────────── */

      this.workletNode.port.postMessage({
        type: 'init',
        sab,
        writeHeadPtr,
        readHeadPtr,
        dataPtr,
        capacity,
      });

      /* ── 7. Connect to output ──────────────────────────────────────── */

      this.workletNode.connect(this.audioContext.destination);

      /* ── 8. Set initial parameters ─────────────────────────────────── */

      this.worker.postMessage({ type: 'setFrequency', value: this.options.frequency });
      this.worker.postMessage({ type: 'setGain', value: this.options.gain });

      /* ── 9. Wire ongoing worker messages ───────────────────────────── */

      this.worker.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === 'error') {
          this.handleError(`Worker error: ${msg.message}`);
        }
      };

      this.setState('running');
    } catch (err) {
      this.handleError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /**
   * Set the oscillator frequency.
   * Forwarded to the Worker → WASM kernel via postMessage.
   *
   * @param freq  Frequency in Hz [20, 20000].
   */
  setFrequency(freq: number): void {
    this.worker?.postMessage({ type: 'setFrequency', value: freq });
  }

  /**
   * Set the output gain.
   * Forwarded to the Worker → WASM kernel via postMessage.
   *
   * @param gain  Gain in [0, 1].
   */
  setGain(gain: number): void {
    this.worker?.postMessage({ type: 'setGain', value: gain });
  }

  /**
   * Stop the audio pipeline and release all resources.
   *
   * Teardown order:
   *   1. Stop the Worker's production loop and dispose the WASM kernel.
   *   2. Disconnect and stop the AudioWorkletNode.
   *   3. Close the AudioContext.
   *
   * Safe to call multiple times (idempotent).
   */
  async stop(): Promise<void> {
    if (this.state === 'idle' || this.state === 'stopping') return;

    this.setState('stopping');

    // 1. Stop the worker (disposes WASM kernel).
    if (this.worker) {
      const stopped = new Promise<void>((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data.type === 'stopped') {
            this.worker!.removeEventListener('message', handler);
            resolve();
          }
        };
        this.worker!.addEventListener('message', handler);
        // Timeout: if the worker doesn't respond in 2s, force terminate.
        setTimeout(() => resolve(), 2000);
      });

      this.worker.postMessage({ type: 'stop' });
      await stopped;
      this.worker.terminate();
      this.worker = null;
    }

    // 2. Disconnect worklet.
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    // 3. Close AudioContext.
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.setState('idle');
  }

  /** Current pipeline state. */
  get currentState(): DSPNodeState {
    return this.state;
  }

  /** The underlying AudioContext (null if not started). */
  get context(): AudioContext | null {
    return this.audioContext;
  }

  /* ─── Internal ────────────────────────────────────────────────────────── */

  private setState(state: DSPNodeState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private handleError(message: string): void {
    this.setState('error');
    this.callbacks.onError?.(message);
  }
}
