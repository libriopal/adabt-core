/**
 * dsp-worklet-processor.ts — AudioWorkletProcessor consumer for the WASM ring buffer.
 *
 * Runs on the AudioWorklet rendering thread.  Receives the WASM-owned
 * SharedArrayBuffer and ring buffer byte offsets via the MessagePort,
 * then pulls 128-sample blocks in process() and pipes them to the
 * hardware output.
 *
 * SELF-CONTAINED: This file must not import external modules.  The
 * AudioWorkletGlobalScope does not support ES module imports in all
 * browsers.  All ring buffer logic is inlined to avoid bundler issues.
 *
 * MEMORY CONTRACT (mirrors SharedRingBuffer.fromWasmMemory):
 *   - WRITE_HEAD and READ_HEAD are monotonic uint32 values.
 *   - Mask applied ONLY at data[] access: index & (capacity - 1).
 *   - Distance = (writeHead - readHead) >>> 0  (unsigned wrap-safe).
 *   - Consumer owns READ_HEAD (relaxed store after pull).
 *   - Consumer acquire-loads WRITE_HEAD to see producer data writes.
 *
 * SETUP MESSAGE (via port.postMessage from main thread):
 *   {
 *     type: 'init',
 *     sab:          SharedArrayBuffer,  // WASM memory .buffer
 *     writeHeadPtr: number,             // byte offset of WRITE_HEAD
 *     readHeadPtr:  number,             // byte offset of READ_HEAD
 *     dataPtr:      number,             // byte offset of Float32 data
 *     capacity:     number,             // ring buffer sample count
 *   }
 */

/* ─── Inline Ring Buffer Consumer ─────────────────────────────────────────── */

const RENDER_QUANTUM = 128; // Web Audio spec: fixed 128-sample block

/**
 * Minimal ring buffer pull — inlined to avoid imports.
 * Mirrors SharedRingBuffer.pull() with acquire/relaxed semantics.
 */
function pullFromRing(
  headers: Int32Array,
  data: Float32Array,
  output: Float32Array,
  blockSize: number,
  capacity: number,
): boolean {
  // Acquire load on WRITE_HEAD — sees all preceding data writes from the producer.
  // Atomics.load provides acquire semantics on SharedArrayBuffer.
  const writeHead = Atomics.load(headers, 0);
  const readHead  = Atomics.load(headers, 1);

  // Monotonic unsigned distance — no mask.
  const available = (writeHead - readHead) >>> 0;

  if (available < blockSize) {
    // Underrun: fill with silence.
    for (let i = 0; i < blockSize; i++) output[i] = 0;
    return false;
  }

  const mask = capacity - 1;
  for (let i = 0; i < blockSize; i++) {
    output[i] = data[(readHead + i) & mask];
  }

  // Relaxed store on READ_HEAD — producer never acquires on this.
  Atomics.store(headers, 1, (readHead + blockSize) >>> 0);
  return true;
}

/* ─── AudioWorkletProcessor ───────────────────────────────────────────────── */

class DSPWorkletProcessor extends AudioWorkletProcessor {
  private headers: Int32Array | null = null;
  private data: Float32Array | null = null;
  private capacity = 0;
  private active = false;
  private underrunCount = 0;

  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent): void {
    const msg = event.data;

    switch (msg.type) {
      case 'init': {
        const { sab, writeHeadPtr, readHeadPtr, dataPtr, capacity } = msg;

        // Validate alignment (4-byte for Int32/Float32 views)
        if (writeHeadPtr % 4 !== 0 || readHeadPtr % 4 !== 0 || dataPtr % 4 !== 0) {
          this.port.postMessage({ type: 'error', message: 'Misaligned pointer offsets' });
          return;
        }

        // Validate header contiguity
        if (readHeadPtr !== writeHeadPtr + 4) {
          this.port.postMessage({ type: 'error', message: 'Non-contiguous header layout' });
          return;
        }

        // Attach typed-array views at WASM-assigned byte offsets.
        // Int32Array for headers (Atomics requires integer views).
        // Float32Array for audio data.
        this.headers  = new Int32Array(sab, writeHeadPtr, 2);
        this.data     = new Float32Array(sab, dataPtr, capacity);
        this.capacity = capacity;
        this.active   = true;
        this.underrunCount = 0;

        this.port.postMessage({ type: 'ready' });
        break;
      }

      case 'stop':
        this.active = false;
        this.headers = null;
        this.data = null;
        break;

      default:
        break;
    }
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    // If not yet initialized or stopped, output silence and keep alive.
    if (!this.active || !this.headers || !this.data) {
      const out = outputs[0]?.[0];
      if (out) out.fill(0);
      return true;
    }

    const output = outputs[0]?.[0];
    if (!output) return true;

    const ok = pullFromRing(
      this.headers,
      this.data,
      output,
      RENDER_QUANTUM,
      this.capacity,
    );

    if (!ok) {
      this.underrunCount++;
      // Report underruns periodically (every 100 = ~266ms at 48kHz)
      if (this.underrunCount % 100 === 1) {
        this.port.postMessage({
          type: 'underrun',
          count: this.underrunCount,
        });
      }
    }

    // Copy channel 0 to all other output channels (mono → multi-channel).
    for (let ch = 1; ch < outputs[0].length; ch++) {
      outputs[0][ch].set(output);
    }

    return true; // Keep processor alive
  }
}

registerProcessor('dsp-worklet-processor', DSPWorkletProcessor);
