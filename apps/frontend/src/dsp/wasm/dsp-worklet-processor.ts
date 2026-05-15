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
 * STEREO OUTPUT:
 *   The mono ring buffer is duplicated to all output channels so the
 *   AudioContext destination receives a proper stereo signal regardless
 *   of the hardware output configuration.  Wire with outputChannelCount: [2].
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
const UNDERRUN_WARN_THRESHOLD = 50; // Consecutive underruns before console.warn

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
  private consecutiveUnderruns = 0;

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
        this.consecutiveUnderruns = 0;

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

    // outputs[0][0] = Left channel, outputs[0][1] = Right channel
    const left = outputs[0]?.[0];
    if (!left) return true;

    const ok = pullFromRing(
      this.headers,
      this.data,
      left,             // Pull mono signal into Left channel
      RENDER_QUANTUM,
      this.capacity,
    );

    if (!ok) {
      this.underrunCount++;
      this.consecutiveUnderruns++;

      // Warn to console after sustained underrun streak
      if (this.consecutiveUnderruns === UNDERRUN_WARN_THRESHOLD) {
        console.warn(
          `[DSPWorklet] Buffer consistently empty — ${this.underrunCount} total underruns. ` +
          `Producer may be stalled or WASM kernel not running.`,
        );
      }

      // Report underruns periodically via port (every 100 = ~266ms at 48kHz)
      if (this.underrunCount % 100 === 1) {
        this.port.postMessage({
          type: 'underrun',
          count: this.underrunCount,
        });
      }
    } else {
      // Reset consecutive underrun counter on successful pull
      this.consecutiveUnderruns = 0;

      // Detect all-zero output — may indicate gain=0 or NaN in ring buffer
      let allZero = true;
      for (let i = 0; i < RENDER_QUANTUM; i++) {
        if (Math.abs(left[i]) > 1e-6) { allZero = false; break; }
      }
      if (allZero) {
        this.port.postMessage({ type: 'warn', message: 'Buffer non-empty but output is all zeros — check gain and sample values' });
      }
    }

    // Copy Left (ch 0) → Right (ch 1) and any additional output channels.
    // This converts the mono WASM ring buffer to stereo for the hardware output.
    for (let ch = 1; ch < outputs[0].length; ch++) {
      outputs[0][ch].set(left);
    }

    return true; // Keep processor alive
  }
}

registerProcessor('dsp-worklet-processor', DSPWorkletProcessor);
