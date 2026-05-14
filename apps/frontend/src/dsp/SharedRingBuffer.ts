/**
 * SPSC lock-free ring buffer over a SharedArrayBuffer.
 *
 * Memory layout (standalone mode — bytes):
 *   [0..3]  WRITE_HEAD : Uint32  — monotonic, producer-owned
 *   [4..7]  READ_HEAD  : Uint32  — monotonic, consumer-owned
 *   [8..]   Float32 data region  — capacity * 4 bytes
 *
 * WASM mode:
 *   The ring buffer headers and data live at linker-assigned addresses inside
 *   WebAssembly.Memory.  Use `fromWasmMemory()` with the byte offsets returned
 *   by the WASM kernel's dsp_write_head_ptr / dsp_read_head_ptr / dsp_data_ptr
 *   exports.  The AudioWorklet consumer receives these offsets (plus the SAB
 *   itself) via postMessage from the Worker that owns the WasmDSPKernel.
 *
 * Indices are MONOTONIC (ever-increasing uint32, wrapping naturally at 2^32).
 * The mask (index & (capacity - 1)) is applied ONLY when addressing data[].
 * This makes full vs. empty unambiguous:
 *   empty : writeHead - readHead === 0
 *   full  : writeHead - readHead === capacity
 * Both conditions are mathematically distinct for any power-of-two capacity ≤ 2^31.
 */

const WRITE_HEAD = 0;
const READ_HEAD = 1;
const HEADER_BYTES = 8;

export class SharedRingBuffer {
  readonly capacity: number;
  private readonly headers: Uint32Array;
  private readonly data: Float32Array;

  /** @param capacity Number of Float32 samples. Must be a power of two. */
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
   * Attach to an existing SharedArrayBuffer — used by the AudioWorklet consumer
   * after the producer posts the SAB via postMessage.
   */
  static fromSharedArrayBuffer(sab: SharedArrayBuffer, capacity: number): SharedRingBuffer {
    const instance = Object.create(SharedRingBuffer.prototype) as SharedRingBuffer;
    (instance as unknown as { capacity: number }).capacity = capacity;
    (instance as unknown as { headers: Uint32Array }).headers = new Uint32Array(sab, 0, 2);
    (instance as unknown as { data: Float32Array }).data = new Float32Array(sab, HEADER_BYTES, capacity);
    return instance;
  }

  /**
   * Attach to a WASM-owned SharedArrayBuffer using the byte offsets returned
   * by the WASM kernel's pointer-getter exports.
   *
   * In the WASM memory-ownership model, the ring buffer headers and data
   * region live at linker-assigned addresses inside WebAssembly.Memory — NOT
   * at fixed offsets 0/8.  The WasmDSPKernel bridge retrieves these addresses
   * via dsp_write_head_ptr / dsp_read_head_ptr / dsp_data_ptr and posts them
   * to the AudioWorklet.  This factory constructs typed-array views at those
   * exact offsets so the consumer sees the same bytes the C kernel writes.
   *
   * Usage in an AudioWorklet processor:
   *
   *   // Received via postMessage from the Worker that created WasmDSPKernel
   *   const { sab, writeHeadPtr, readHeadPtr, dataPtr, capacity } = msg;
   *   const ring = SharedRingBuffer.fromWasmMemory(
   *     sab, writeHeadPtr, readHeadPtr, dataPtr, capacity,
   *   );
   *   // ring.pull(output, 128) reads from the WASM kernel's zero-copy path
   *
   * @param sab             wasmMemory.buffer (SharedArrayBuffer) from the WASM kernel.
   * @param writeHeadPtr    Byte offset of WRITE_HEAD (from dsp_write_head_ptr()).
   * @param readHeadPtr     Byte offset of READ_HEAD  (from dsp_read_head_ptr()).
   *                        Must equal writeHeadPtr + 4 (contiguous g_ring_headers[2]).
   * @param dataPtr         Byte offset of the Float32 data region (from dsp_data_ptr()).
   * @param capacity        Ring buffer capacity in samples (power of two).
   * @throws RangeError     If capacity is not a power of two, or byte offsets are
   *                        not correctly aligned (4-byte for headers, 4-byte for data).
   */
  static fromWasmMemory(
    sab: SharedArrayBuffer,
    writeHeadPtr: number,
    readHeadPtr: number,
    dataPtr: number,
    capacity: number,
  ): SharedRingBuffer {
    if (capacity <= 0 || (capacity & (capacity - 1)) !== 0) {
      throw new RangeError(`SharedRingBuffer: capacity must be a power of two, got ${capacity}`);
    }

    /* Alignment checks: Uint32Array requires 4-byte alignment,
     * Float32Array requires 4-byte alignment. */
    if (writeHeadPtr % 4 !== 0) {
      throw new RangeError(
        `SharedRingBuffer: writeHeadPtr (${writeHeadPtr}) is not 4-byte aligned`,
      );
    }
    if (readHeadPtr % 4 !== 0) {
      throw new RangeError(
        `SharedRingBuffer: readHeadPtr (${readHeadPtr}) is not 4-byte aligned`,
      );
    }
    if (dataPtr % 4 !== 0) {
      throw new RangeError(
        `SharedRingBuffer: dataPtr (${dataPtr}) is not 4-byte aligned`,
      );
    }

    /* Contiguity check: g_ring_headers is a 2-element uint32 array,
     * so READ_HEAD must be exactly 4 bytes after WRITE_HEAD. */
    if (readHeadPtr !== writeHeadPtr + 4) {
      throw new RangeError(
        `SharedRingBuffer: readHeadPtr (${readHeadPtr}) must be writeHeadPtr + 4 ` +
        `(${writeHeadPtr + 4}). Non-contiguous header layout is not supported.`,
      );
    }

    /* Bounds check: ensure the data region fits inside the SAB. */
    const dataEnd = dataPtr + capacity * Float32Array.BYTES_PER_ELEMENT;
    if (dataEnd > sab.byteLength) {
      throw new RangeError(
        `SharedRingBuffer: data region [${dataPtr}..${dataEnd}) exceeds SAB ` +
        `byteLength (${sab.byteLength})`,
      );
    }

    const instance = Object.create(SharedRingBuffer.prototype) as SharedRingBuffer;
    (instance as unknown as { capacity: number }).capacity = capacity;
    (instance as unknown as { headers: Uint32Array }).headers = new Uint32Array(sab, writeHeadPtr, 2);
    (instance as unknown as { data: Float32Array }).data = new Float32Array(sab, dataPtr, capacity);
    return instance;
  }

  get sharedArrayBuffer(): SharedArrayBuffer {
    return this.data.buffer as SharedArrayBuffer;
  }

  // ---------------------------------------------------------------------------
  // Producer API  (WASM Worker thread only)
  // ---------------------------------------------------------------------------

  /**
   * Write `samples` into the buffer.
   * Returns false on back-pressure (not enough free space); does not overwrite.
   */
  push(samples: Float32Array): boolean {
    const writeHead = Atomics.load(this.headers, WRITE_HEAD); // relaxed
    const readHead  = Atomics.load(this.headers, READ_HEAD);  // relaxed

    // Monotonic distance: no mask here — gives true count [0 .. capacity].
    const used = (writeHead - readHead) >>> 0;
    const free = this.capacity - used;
    if (samples.length > free) return false;

    for (let i = 0; i < samples.length; i++) {
      this.data[(writeHead + i) & (this.capacity - 1)] = samples[i];
    }

    // Release store — all data[] writes are visible before the head advances.
    Atomics.store(this.headers, WRITE_HEAD, (writeHead + samples.length) >>> 0);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Consumer API  (AudioWorklet process() only)
  // ---------------------------------------------------------------------------

  /**
   * Read `blockSize` samples into `output`.
   * Returns false on underrun; fills `output` with silence in that case.
   */
  pull(output: Float32Array, blockSize: number): boolean {
    // Acquire load — establishes happens-before with the producer's release store.
    const writeHead = Atomics.load(this.headers, WRITE_HEAD); // acquire
    const readHead  = Atomics.load(this.headers, READ_HEAD);  // relaxed (we own it)

    // Monotonic distance — no mask, gives true count [0 .. capacity].
    const available = (writeHead - readHead) >>> 0;
    if (available < blockSize) {
      output.fill(0, 0, blockSize);
      return false;
    }

    for (let i = 0; i < blockSize; i++) {
      output[i] = this.data[(readHead + i) & (this.capacity - 1)];
    }

    // Relaxed store — producer never acquires on READ_HEAD.
    Atomics.store(this.headers, READ_HEAD, (readHead + blockSize) >>> 0);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Diagnostics (snapshot — safe from either thread)
  // ---------------------------------------------------------------------------

  get availableSamples(): number {
    const w = Atomics.load(this.headers, WRITE_HEAD);
    const r = Atomics.load(this.headers, READ_HEAD);
    return (w - r) >>> 0;
  }

  get freeSamples(): number {
    return this.capacity - this.availableSamples;
  }
}
