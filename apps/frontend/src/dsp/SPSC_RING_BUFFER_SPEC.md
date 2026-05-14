# SPSC Ring Buffer — Acquire/Release Memory Model Spec

## Overview

Single-Producer / Single-Consumer (SPSC) lock-free ring buffer for crossing the
WASM Worker → AudioWorklet thread boundary via a `SharedArrayBuffer`.

The correctness guarantee rests entirely on the acquire/release fence pair. No
mutex or `Atomics.wait` is used; this ring buffer is safe to call from an
AudioWorklet's `process()` callback.

---

## Shared Memory Layout

```
[ WRITE_HEAD : Uint32 @ offset 0 ]   ← producer owns writes
[ READ_HEAD  : Uint32 @ offset 4 ]   ← consumer owns writes
[ data[0..N-1] : Float32 @ offset 8 ]
```

Capacity **N** must be a power of two. Indices wrap via bitwise AND:
`index & (N - 1)`.

---

## Producer Protocol (WASM Worker thread)

```ts
// 1. Read consumer's read head (relaxed — only used for space check).
const readHead  = Atomics.load(headers, READ_HEAD_IDX);   // relaxed
const writeHead = Atomics.load(headers, WRITE_HEAD_IDX);  // relaxed

// 2. Check space.
const available = N - ((writeHead - readHead) & (N - 1));
if (available < samplesNeeded) return false; // back-pressure

// 3. Write sample data into Float32 region (plain array writes).
for (let i = 0; i < samplesNeeded; i++) {
  data[(writeHead + i) & (N - 1)] = samples[i];
}

// 4. RELEASE fence — publishes all data writes before advancing the head.
Atomics.store(headers, WRITE_HEAD_IDX, (writeHead + samplesNeeded) & (N - 1));
//            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//            The store itself acts as the release fence in JS Atomics.
```

**Why release?**  
A release store on `WRITE_HEAD` ensures that all preceding plain writes to the
`Float32Array` data region are visible to any thread that subsequently performs
an acquire load on `WRITE_HEAD`. Without this ordering guarantee a CPU or JIT
could reorder the index advance before the data writes, exposing partially-written
frames to the consumer.

---

## Consumer Protocol (AudioWorklet `process()`)

```ts
// 1. ACQUIRE fence — establishes happens-before with the producer's release.
const writeHead = Atomics.load(headers, WRITE_HEAD_IDX);  // acquire
//                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                Seeing the updated writeHead guarantees all data[] writes
//                that preceded the producer's release store are now visible.

const readHead = Atomics.load(headers, READ_HEAD_IDX);    // relaxed (we own it)

// 2. Check available samples.
const available = (writeHead - readHead) & (N - 1);
if (available < blockSize) return false; // underrun — output silence

// 3. Read samples (plain array reads — safe after acquire).
for (let i = 0; i < blockSize; i++) {
  output[i] = data[(readHead + i) & (N - 1)];
}

// 4. Advance consumer head (relaxed — producer never acquires on READ_HEAD).
Atomics.store(headers, READ_HEAD_IDX, (readHead + blockSize) & (N - 1));
```

---

## Invariants

| Property | Guarantee |
|---|---|
| Lock-free | No blocking primitives; safe inside `process()` |
| Single-producer | Only one writer thread calls `push()` at a time |
| Single-consumer | Only one reader thread calls `pull()` at a time |
| Capacity | Always a power of two; wrap via `& (N-1)` |
| Overwrite protection | Producer checks free space before writing |
| Memory ordering | Release on `WRITE_HEAD` store / Acquire on `WRITE_HEAD` load |

---

## Failure Modes

- **Underrun** — Consumer calls `pull()` with fewer samples available than
  requested. Consumer outputs silence for that block and increments a `underrunCount`
  metric.
- **Overrun** — Producer calls `push()` when buffer is full. Producer drops the
  block and increments an `overrunCount` metric. It does **not** overwrite live data.
