/**
 * dsp-kernel.c — WASM DSP Processing Kernel (Phase 1: Foundational DSP)
 *
 * Compiled to .wasm via Emscripten.  Runs inside a Web Worker.
 * Writes processed audio samples into the SharedRingBuffer's SAB.
 *
 * MONOTONIC HEAD CONTRACT:
 *   - WRITE_HEAD and READ_HEAD are ever-increasing uint32 values.
 *   - The mask (index & (capacity - 1)) is applied ONLY when addressing data[].
 *   - Distance = (writeHead - readHead) as uint32  (unsigned wrap-safe).
 *   - Full:  distance == capacity.
 *   - Empty: distance == 0.
 *
 * MEMORY ORDERING:
 *   - Producer (this kernel): relaxed loads on both heads for space calc,
 *     release store on WRITE_HEAD after data writes.
 *   - Consumer (AudioWorklet): acquire load on WRITE_HEAD, relaxed on READ_HEAD.
 *
 * ZERO-ALLOCATION HOT PATH:
 *   - No malloc/free in process().
 *   - All state is pre-allocated in dsp_kernel_init().
 *   - DSP uses fixed-size local stack buffers (≤ DSP_BLOCK_SIZE).
 *
 * TIER 0 COMPLIANCE:
 *   - 128-sample blocks at 48 kHz = ~2.67 ms budget per quantum.
 *   - WASM linear memory: INITIAL_MEMORY=256KB, MAXIMUM_MEMORY=1MB.
 *   - No SIMD in Phase 1 (Tier 0 Android may lack it).
 */

#include "dsp-kernel.h"
#include <math.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/* ─── WASM Atomic Intrinsics ──────────────────────────────────────────────── */
/*
 * Emscripten compiles __atomic_load_n / __atomic_store_n to the correct
 * WASM atomic instructions (i32.atomic.load / i32.atomic.store) when the
 * -pthread and -matomics flags are set.  These map directly to the
 * Atomics.load / Atomics.store semantics on the JS side.
 *
 * __ATOMIC_RELAXED = 0  (no ordering constraint)
 * __ATOMIC_ACQUIRE = 2  (load barrier — sees preceding release stores)
 * __ATOMIC_RELEASE = 3  (store barrier — preceding writes visible to acquirers)
 */

static inline uint32_t atomic_load_relaxed(volatile uint32_t *ptr) {
    return __atomic_load_n(ptr, __ATOMIC_RELAXED);
}

static inline uint32_t atomic_load_acquire(volatile uint32_t *ptr) {
    return __atomic_load_n(ptr, __ATOMIC_ACQUIRE);
}

static inline void atomic_store_relaxed(volatile uint32_t *ptr, uint32_t val) {
    __atomic_store_n(ptr, val, __ATOMIC_RELAXED);
}

static inline void atomic_store_release(volatile uint32_t *ptr, uint32_t val) {
    __atomic_store_n(ptr, val, __ATOMIC_RELEASE);
}

/* ─── Ring Buffer Storage (compiler-placed in WASM data/BSS segment) ─────── */
/*
 * Declaring these as static globals lets the linker assign fixed addresses
 * inside the WASM data segment.  This eliminates the sab_ptr parameter that
 * previously required the TS bridge to guarantee a collision-free byte offset
 * by hand.  The compiler owns the layout; the stack and bump heap cannot
 * overlap these arrays.
 *
 * g_ring_headers[0] = WRITE_HEAD (producer, release-store on advance)
 * g_ring_headers[1] = READ_HEAD  (consumer, relaxed store on advance)
 * g_audio_data[]    = Float32 sample ring (capacity ≤ DSP_MAX_CAPACITY)
 *
 * The TS bridge retrieves the byte offsets via the dsp_*_ptr() exports and
 * attaches Int32Array / Float32Array views at those offsets into wasmMemory.buffer.
 */

static volatile uint32_t g_ring_headers[2] = {0, 0};  /* WRITE_HEAD, READ_HEAD */
static float              g_audio_data[DSP_MAX_CAPACITY];

/* ─── Simple Bump Allocator (WASM linear memory) ─────────────────────────── */
/*
 * We avoid malloc/free entirely. A trivial bump allocator is sufficient
 * because the kernel is allocated once and torn down once per session.
 * WASM linear memory is bounded and released when the module is closed.
 */

static uint8_t  g_heap[16384] __attribute__((aligned(16)));
static uint32_t g_heap_offset = 0;

static void *bump_alloc(uint32_t size) {
    /* Align to 16 bytes */
    uint32_t aligned = (g_heap_offset + 15) & ~15u;
    if (aligned + size > sizeof(g_heap)) return 0;
    void *ptr = &g_heap[aligned];
    g_heap_offset = aligned + size;
    return ptr;
}

static void bump_reset(void) {
    g_heap_offset = 0;
}

/* ─── Power-of-two validation ─────────────────────────────────────────────── */

static int is_power_of_two(uint32_t v) {
    return v > 0 && (v & (v - 1)) == 0;
}

/* ─── Exported Functions ──────────────────────────────────────────────────── */

/**
 * Initialize the DSP kernel.
 *
 * Ring buffer storage (g_ring_headers, g_audio_data) is compiler-placed in
 * the WASM data/BSS segment.  Call dsp_write_head_ptr / dsp_read_head_ptr /
 * dsp_data_ptr after this returns to retrieve the byte offsets for typed-array
 * view attachment on the TS side.
 */
__attribute__((export_name("dsp_kernel_init")))
DspKernelState* dsp_kernel_init(uint32_t capacity, uint32_t sample_rate) {
    /* Validate capacity */
    if (!is_power_of_two(capacity) ||
        capacity < DSP_MIN_CAPACITY ||
        capacity > DSP_MAX_CAPACITY) {
        return 0;
    }

    /* Validate sample rate */
    if (sample_rate == 0 || sample_rate > 192000) {
        return 0;
    }

    bump_reset();
    DspKernelState *state = (DspKernelState *)bump_alloc(sizeof(DspKernelState));
    if (!state) return 0;

    /* Point at the compiler-placed static ring buffer storage.
     * The linker guarantees g_ring_headers and g_audio_data live in the WASM
     * data/BSS segment at fixed addresses — no manual offset arithmetic needed.
     */
    state->headers     = g_ring_headers;
    state->data        = g_audio_data;
    state->capacity    = capacity;
    state->mask        = capacity - 1;
    state->sample_rate = sample_rate;
    state->channels    = 1;  /* Mono for Phase 1 */
    state->phase       = 0.0f;
    state->freq        = 440.0f;  /* Default A4 */
    state->gain        = 0.5f;

    /* Zero IIR state */
    for (int i = 0; i < DSP_MAX_CHANNELS; i++) {
        state->z1[i] = 0.0f;
    }

    state->frames_produced = 0;
    state->overruns        = 0;

    return state;
}

/**
 * Generate and push `frame_count` samples into the ring buffer.
 *
 * HOT PATH — no allocations, no blocking, no function pointers.
 *
 * DSP pipeline (Phase 1):
 *   1. Sine oscillator (deterministic: phase accumulator, no random state)
 *   2. One-pole IIR smoothing (coefficient = 0.995, ~10ms decay at 48kHz)
 *   3. Gain stage
 *
 * Returns the number of samples actually written.  If the ring buffer is
 * full (back-pressure), returns 0 and increments the overrun counter.
 */
__attribute__((export_name("dsp_kernel_process")))
uint32_t dsp_kernel_process(DspKernelState *state, uint32_t frame_count) {
    if (!state || frame_count == 0) return 0;

    /* Clamp frame_count to a reasonable maximum to prevent stack overflow */
    if (frame_count > DSP_BLOCK_SIZE) {
        frame_count = DSP_BLOCK_SIZE;
    }

    /* ── 1. Check available space (relaxed loads for space calculation) ──── */
    uint32_t write_head = atomic_load_relaxed(&state->headers[SAB_WRITE_HEAD_IDX]);
    uint32_t read_head  = atomic_load_relaxed(&state->headers[SAB_READ_HEAD_IDX]);

    /*
     * Monotonic distance: unsigned subtraction.
     * In C, uint32_t arithmetic wraps naturally (mod 2^32), so this is
     * equivalent to the JS `(writeHead - readHead) >>> 0`.
     */
    uint32_t used = write_head - read_head;  /* uint32 wrap-safe */
    uint32_t free_slots = state->capacity - used;

    if (frame_count > free_slots) {
        /* Back-pressure: ring buffer is full or near-full.
         * Do NOT overwrite live data — the consumer hasn't read it yet. */
        state->overruns++;
        return 0;
    }

    /* ── 2. Generate DSP samples ────────────────────────────────────────── */

    float phase      = state->phase;
    float phase_inc  = state->freq / (float)state->sample_rate;
    float gain       = state->gain;
    float z1         = state->z1[0];
    float coeff      = 0.995f;  /* One-pole smoothing: ~10ms @ 48kHz */

    float *data      = state->data;
    uint32_t mask    = state->mask;

    for (uint32_t i = 0; i < frame_count; i++) {
        /* Sine oscillator (deterministic — phase accumulator, no randomness) */
        float sample = sinf(2.0f * (float)M_PI * phase);

        /* Phase accumulator: keep in [0, 1) to avoid float precision drift */
        phase += phase_inc;
        if (phase >= 1.0f) phase -= 1.0f;

        /* One-pole IIR smoothing */
        z1 = coeff * z1 + (1.0f - coeff) * sample;

        /* Gain stage */
        float out = z1 * gain;

        /* Write to ring buffer — MASK APPLIED ONLY HERE */
        data[(write_head + i) & mask] = out;
    }

    /* Persist DSP state */
    state->phase = phase;
    state->z1[0] = z1;

    /* ── 3. Release store on WRITE_HEAD ─────────────────────────────────── */
    /*
     * All data[] writes above MUST be visible to the consumer before
     * the WRITE_HEAD advances.  The release store provides this guarantee:
     * any thread performing an acquire load on WRITE_HEAD will see all
     * preceding writes to the data region.
     *
     * The new head value is monotonic — we add frame_count, and uint32
     * wraps naturally at 2^32, matching the JS `(writeHead + n) >>> 0`.
     */
    uint32_t new_write_head = write_head + frame_count;  /* uint32 wrap-safe */
    atomic_store_release(&state->headers[SAB_WRITE_HEAD_IDX], new_write_head);

    state->frames_produced += frame_count;

    return frame_count;
}

/* ─── Ring Buffer Pointer Exports ────────────────────────────────────────── */
/*
 * These three functions return the WASM linear-memory byte offsets of the
 * ring buffer's header words and data array.  The TS bridge calls them once
 * after dsp_kernel_init() and uses the returned values as byteOffset arguments
 * when constructing Int32Array / Float32Array views into wasmMemory.buffer:
 *
 *   const wh = new Int32Array(sab, exports.dsp_write_head_ptr(), 1);
 *   const rh = new Int32Array(sab, exports.dsp_read_head_ptr(),  1);
 *   const d  = new Float32Array(sab, exports.dsp_data_ptr(), capacity);
 */

__attribute__((export_name("dsp_write_head_ptr")))
uint32_t dsp_write_head_ptr(void) {
    return (uint32_t)(uintptr_t)&g_ring_headers[SAB_WRITE_HEAD_IDX];
}

__attribute__((export_name("dsp_read_head_ptr")))
uint32_t dsp_read_head_ptr(void) {
    return (uint32_t)(uintptr_t)&g_ring_headers[SAB_READ_HEAD_IDX];
}

__attribute__((export_name("dsp_data_ptr")))
uint32_t dsp_data_ptr(void) {
    return (uint32_t)(uintptr_t)g_audio_data;
}

/* ─── Parameter Setters ───────────────────────────────────────────────────── */

__attribute__((export_name("dsp_kernel_set_freq")))
void dsp_kernel_set_freq(DspKernelState *state, float freq) {
    if (!state) return;
    /* Clamp to audible range (Tier 0 safety: avoid absurd phase increments) */
    if (freq < 20.0f) freq = 20.0f;
    if (freq > 20000.0f) freq = 20000.0f;
    state->freq = freq;
}

__attribute__((export_name("dsp_kernel_set_gain")))
void dsp_kernel_set_gain(DspKernelState *state, float gain) {
    if (!state) return;
    if (gain < 0.0f) gain = 0.0f;
    if (gain > 1.0f) gain = 1.0f;
    state->gain = gain;
}

/* ─── Diagnostics ─────────────────────────────────────────────────────────── */

__attribute__((export_name("dsp_kernel_get_overruns")))
uint32_t dsp_kernel_get_overruns(DspKernelState *state) {
    return state ? state->overruns : 0;
}

__attribute__((export_name("dsp_kernel_get_frames_produced")))
uint32_t dsp_kernel_get_frames_produced(DspKernelState *state) {
    return state ? state->frames_produced : 0;
}

/* ─── Teardown ────────────────────────────────────────────────────────────── */

__attribute__((export_name("dsp_kernel_teardown")))
void dsp_kernel_teardown(DspKernelState *state) {
    if (!state) return;
    /* Zero all state to prevent dangling reads */
    state->headers = 0;
    state->data = 0;
    state->capacity = 0;
    state->mask = 0;
    state->frames_produced = 0;
    state->overruns = 0;
    state->phase = 0.0f;
    state->freq = 0.0f;
    state->gain = 0.0f;
    for (int i = 0; i < DSP_MAX_CHANNELS; i++) {
        state->z1[i] = 0.0f;
    }
    /* Reset bump allocator — reclaims all WASM-side allocations */
    bump_reset();
}
