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
[ WRITE_HEAD : Uint32 @ offset 0 ]   ← monotonic, producer-owned
[ READ_HEAD  : Uint32 @ offset 4 ]   ← monotonic, consumer-owned
[ data[0..N-1] : Float32 @ offset 8 ]
```

Capacity **N** must be a power of two.

### Monotonic Index Strategy

Both heads are **ever-increasing `uint32` values**. They are never masked on
store — they wrap naturally at `2^32`. The mask `& (N - 1)` is applied **only**
when addressing the data array:

```
data[head & (N - 1)]
```

The filled distance between the two heads is computed via **unsigned subtraction**:

```
distance = (writeHead - readHead) >>> 0
```

The `>>> 0` cast forces the result into an unsigned 32-bit integer, which keeps
the value correct across the natural `uint32` wrap-around. This gives two
mathematically distinct sentinel states:

| Condition | Meaning |
|---|---|
| `distance === 0` | Buffer is **empty** |
| `distance === N` | Buffer is **full** |

With the old masked-subtraction approach (`(write - read) & (N-1)`) both states
collapsed to `0`, making it impossible to distinguish full from empty without an
extra flag. Monotonic indices eliminate that aliasing entirely.

---

## Producer Protocol (WASM Worker thread)

```ts
// 1. Load both heads (relaxed — used only for space calculation).
const writeHead = Atomics.load(headers, WRITE_HEAD_IDX); // relaxed
const readHead  = Atomics.load(headers, READ_HEAD_IDX);  // relaxed

// 2. Compute free slots using monotonic unsigned distance. No mask here.
const used = (writeHead - readHead) >>> 0;  // true count in [0 .. N]
const free = N - used;
if (samplesNeeded > free) return false;     // back-pressure, do not overwrite

// 3. Write sample data — mask applied only at array access.
for (let i = 0; i < samplesNeeded; i++) {
  data[(writeHead + i) & (N - 1)] = samples[i];
}

// 4. RELEASE store — advance the monotonic head WITHOUT masking.
Atomics.store(headers, WRITE_HEAD_IDX, (writeHead + samplesNeeded) >>> 0);
//            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//            The store acts as the release fence. All preceding data[] writes
//            are guaranteed visible to any thread that subsequently performs
//            an acquire load on WRITE_HEAD.
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
// 1. ACQUIRE load — establishes happens-before with the producer's release store.
const writeHead = Atomics.load(headers, WRITE_HEAD_IDX); // acquire
//                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                Seeing the updated writeHead guarantees all data[] writes that
//                preceded the producer's release store are now visible here.

const readHead = Atomics.load(headers, READ_HEAD_IDX);   // relaxed (we own it)

// 2. Compute available samples using monotonic unsigned distance. No mask here.
const available = (writeHead - readHead) >>> 0;  // true count in [0 .. N]
if (available < blockSize) {
  output.fill(0, 0, blockSize);
  return false; // underrun — output silence
}

// 3. Read samples — mask applied only at array access.
for (let i = 0; i < blockSize; i++) {
  output[i] = data[(readHead + i) & (N - 1)];
}

// 4. Advance consumer head — monotonic, no mask, relaxed store.
Atomics.store(headers, READ_HEAD_IDX, (readHead + blockSize) >>> 0);
// Relaxed: the producer never performs an acquire load on READ_HEAD.
```

---

## Invariants

| Property | Guarantee |
|---|---|
| Lock-free | No blocking primitives; safe inside `process()` |
| Single-producer | Only one writer thread calls `push()` at a time |
| Single-consumer | Only one reader thread calls `pull()` at a time |
| Capacity | Always a power of two |
| Index strategy | Monotonic uint32; mask `& (N-1)` applied only at `data[]` access |
| Distance arithmetic | `(write - read) >>> 0` — unsigned, no mask; range `[0 .. N]` |
| Full/empty distinction | `distance == N` → full; `distance == 0` → empty; never aliased |
| Overwrite protection | Producer checks free space before writing |
| Memory ordering | Release on `WRITE_HEAD` store / Acquire on `WRITE_HEAD` load |

---

## Failure Modes

- **Underrun** — Consumer calls `pull()` with fewer samples available than
  requested. Consumer fills the output block with silence and returns `false`.
- **Overrun** — Producer calls `push()` when the buffer is full (`distance == N`).
  Producer drops the block and returns `false`. It does **not** overwrite live data.
