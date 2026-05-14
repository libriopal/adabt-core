/**
 * SPSC lock-free ring buffer over a SharedArrayBuffer.
 *
 * Memory layout (bytes):
 *   [0..3]  WRITE_HEAD : Uint32  — producer-owned write index
 *   [4..7]  READ_HEAD  : Uint32  — consumer-owned read index
 *   [8..]   Float32 data region  — capacity * 4 bytes
 *
 * Both indices are logical (never masked); masking happens at access time
 * via `index & (capacity - 1)` so the distance arithmetic stays correct
 * across the single wrap-around before both heads are reset.
 */

const WRITE_HEAD = 0; // Uint32 index into headers
const READ_HEAD = 1;  // Uint32 index into headers
const HEADER_BYTES = 8;

export class SharedRingBuffer {
  readonly capacity: number;
  private readonly headers: Uint32Array;
  private readonly data: Float32Array;

  /**
   * @param capacity  Number of Float32 samples. Must be a power of two.
   */
  constructor(capacity: number = 2048) {
    if (capacity <= 0 || (capacity & (capacity - 1)) !== 0) {
      throw new RangeError(`SharedRingBuffer: capacity must be a power of two, got ${capacity}`);
    }
    this.capacity = capacity;

    const sab = new SharedArrayBuffer(HEADER_BYTES + capacity * Float32Array.BYTES_PER_ELEMENT);
    this.headers = new Uint32Array(sab, 0, 2);
    this.data = new Float32Array(sab, HEADER_BYTES, capacity);
  }

  /**
   * Construct a SharedRingBuffer view over an existing SharedArrayBuffer.
   * Used by the consumer (AudioWorklet) to attach to memory the producer already created.
   */
  static fromSharedArrayBuffer(sab: SharedArrayBuffer, capacity: number): SharedRingBuffer {
    const instance = Object.create(SharedRingBuffer.prototype) as SharedRingBuffer;
    (instance as { capacity: number }).capacity = capacity;
    (instance as { headers: Uint32Array }).headers = new Uint32Array(sab, 0, 2);
    (instance as { data: Float32Array }).data = new Float32Array(sab, HEADER_BYTES, capacity);
    return instance;
  }

  /** Returns the underlying SharedArrayBuffer for transfer to another thread. */
  get sharedArrayBuffer(): SharedArrayBuffer {
    return this.data.buffer as SharedArrayBuffer;
  }

  // ---------------------------------------------------------------------------
  // Producer API (call from WASM Worker only)
  // ---------------------------------------------------------------------------

  /**
   * Push `samples` into the ring buffer.
   * Returns true on success, false if there is insufficient space (back-pressure).
   */
  push(samples: Float32Array): boolean {
    const writeHead = Atomics.load(this.headers, WRITE_HEAD); // relaxed
    const readHead = Atomics.load(this.headers, READ_HEAD);   // relaxed

    const freeSlots = this.capacity - ((writeHead - readHead) & (this.capacity - 1));
    if (samples.length > freeSlots) {
      return false; // overrun protection — do not clobber live data
    }

    for (let i = 0; i < samples.length; i++) {
      this.data[(writeHead + i) & (this.capacity - 1)] = samples[i];
    }

    // Release store — publishes all data[] writes before advancing the head.
    Atomics.store(this.headers, WRITE_HEAD, (writeHead + samples.length) & 0xFFFFFFFF);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Consumer API (call from AudioWorklet process() only)
  // ---------------------------------------------------------------------------

  /**
   * Pull `blockSize` samples into `output`.
   * Returns true on success, false on underrun (caller should output silence).
   */
  pull(output: Float32Array, blockSize: number): boolean {
    // Acquire load — establishes happens-before with the producer's release store.
    const writeHead = Atomics.load(this.headers, WRITE_HEAD); // acquire
    const readHead = Atomics.load(this.headers, READ_HEAD);   // relaxed (we own it)

    const available = (writeHead - readHead) & (this.capacity - 1);
    if (available < blockSize) {
      output.fill(0, 0, blockSize);
      return false; // underrun — silence this block
    }

    for (let i = 0; i < blockSize; i++) {
      output[i] = this.data[(readHead + i) & (this.capacity - 1)];
    }

    // Relaxed store — producer never acquires on READ_HEAD.
    Atomics.store(this.headers, READ_HEAD, (readHead + blockSize) & 0xFFFFFFFF);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Diagnostics (safe to call from either thread; values are snapshots)
  // ---------------------------------------------------------------------------

  get availableSamples(): number {
    const w = Atomics.load(this.headers, WRITE_HEAD);
    const r = Atomics.load(this.headers, READ_HEAD);
    return (w - r) & (this.capacity - 1);
  }

  get freeSamples(): number {
    return this.capacity - this.availableSamples;
  }
}
