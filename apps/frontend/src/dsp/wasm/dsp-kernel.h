/**
 * dsp-kernel.h — WASM DSP Kernel shared definitions.
 *
 * This header defines the C-side interface to the SharedRingBuffer and the
 * DSP processing kernel that runs inside a Web Worker.
 *
 * Memory model contract:
 *   - WRITE_HEAD and READ_HEAD are MONOTONIC uint32 values.
 *   - Mask (index & (capacity - 1)) is applied ONLY at data[] access.
 *   - Distance = (writeHead - readHead) as unsigned 32-bit.
 *   - Full: distance == capacity.  Empty: distance == 0.
 *
 * Ring buffer storage:
 *   - g_ring_headers[2] and g_audio_data[] are static globals placed by the
 *     linker in the WASM data/BSS segment.  Their addresses are returned by
 *     the dsp_write_head_ptr / dsp_read_head_ptr / dsp_data_ptr exports so
 *     the TS bridge can attach typed-array views without relying on a
 *     hard-coded offset or a separately-allocated SharedArrayBuffer.
 *
 * This file is shared between dsp-kernel.c and the TS bridge types.
 */

#ifndef DSP_KERNEL_H
#define DSP_KERNEL_H

#include <stdint.h>

/* ─── Ring Buffer Header Indices (into g_ring_headers[]) ──────────────────── */

#define SAB_WRITE_HEAD_IDX  0   /* g_ring_headers[0] — monotonic, producer-owned */
#define SAB_READ_HEAD_IDX   1   /* g_ring_headers[1] — monotonic, consumer-owned */

/* ─── Kernel Configuration ─────────────────────────────────────────────────── */

/** Maximum number of channels (interleaved).  Mono for Phase 1. */
#define DSP_MAX_CHANNELS       1

/** Minimum capacity (Tier 0 Android: 128 samples). */
#define DSP_MIN_CAPACITY       128

/** Maximum capacity (Tier 4 workstation: 16384 samples). */
#define DSP_MAX_CAPACITY       16384

/** Default processing block size (AudioWorklet quantum). */
#define DSP_BLOCK_SIZE         128

/* ─── Kernel State ─────────────────────────────────────────────────────────── */

/**
 * Opaque kernel state — allocated in WASM linear memory.
 * One instance per DSP pipeline lifetime.
 */
typedef struct {
    /* Ring buffer pointers (into SAB, imported memory) */
    volatile uint32_t *headers;     /* Pointer to the Uint32 header region         */
    float             *data;        /* Pointer to the Float32 data region          */
    uint32_t           capacity;    /* Power-of-two sample count                   */
    uint32_t           mask;        /* capacity - 1, precomputed for masking       */

    /* DSP state */
    uint32_t           sample_rate; /* e.g. 48000                                  */
    uint32_t           channels;    /* Interleaved channel count (1 for Phase 1)   */
    float              phase;       /* Oscillator phase accumulator [0, 1)         */
    float              freq;        /* Current frequency in Hz                     */
    float              gain;        /* Output gain [0, 1]                          */

    /* One-pole IIR state per channel (smoothing / envelope) */
    float              z1[DSP_MAX_CHANNELS];

    /* Diagnostics */
    uint32_t           frames_produced;   /* Total frames written (monotonic)      */
    uint32_t           overruns;          /* Push rejections (buffer full)         */
} DspKernelState;

/* ─── Exported Functions (WASM boundary) ───────────────────────────────────── */

/**
 * Allocate and initialize the kernel state.
 *
 * The ring buffer storage (g_ring_headers, g_audio_data) is compiler-placed in
 * the WASM data/BSS segment.  No sab_ptr argument is needed; call
 * dsp_write_head_ptr / dsp_read_head_ptr / dsp_data_ptr after init to retrieve
 * the byte offsets for typed-array view attachment on the TS side.
 *
 * @param capacity    Ring buffer capacity in samples (power of two, ≤ DSP_MAX_CAPACITY).
 * @param sample_rate Audio sample rate (e.g. 48000).
 * @return            Pointer to the allocated DspKernelState, or 0 on failure.
 */
DspKernelState* dsp_kernel_init(uint32_t capacity, uint32_t sample_rate);

/**
 * Return the WASM linear-memory byte offset of WRITE_HEAD (g_ring_headers[0]).
 * Use as the byteOffset argument when constructing Int32Array / Atomics views.
 */
uint32_t dsp_write_head_ptr(void);

/**
 * Return the WASM linear-memory byte offset of READ_HEAD (g_ring_headers[1]).
 */
uint32_t dsp_read_head_ptr(void);

/**
 * Return the WASM linear-memory byte offset of the Float32 audio data region.
 */
uint32_t dsp_data_ptr(void);

/**
 * Process `frame_count` frames of DSP and push them into the ring buffer.
 *
 * This is the hot path. Zero allocations. No blocking.
 * The kernel generates audio samples (currently: sine oscillator + one-pole
 * smoothing) and writes them into the SAB data region via monotonic WRITE_HEAD.
 *
 * @param state        Kernel state pointer from dsp_kernel_init().
 * @param frame_count  Number of samples to generate and push.
 * @return             Number of samples actually written (may be < frame_count
 *                     if the ring buffer is full — back-pressure).
 */
uint32_t dsp_kernel_process(DspKernelState *state, uint32_t frame_count);

/**
 * Set the oscillator frequency.
 *
 * @param state  Kernel state.
 * @param freq   Frequency in Hz.
 */
void dsp_kernel_set_freq(DspKernelState *state, float freq);

/**
 * Set the output gain.
 *
 * @param state  Kernel state.
 * @param gain   Gain in [0, 1].
 */
void dsp_kernel_set_gain(DspKernelState *state, float gain);

/**
 * Get cumulative overrun count (diagnostic).
 */
uint32_t dsp_kernel_get_overruns(DspKernelState *state);

/**
 * Get total frames produced (diagnostic).
 */
uint32_t dsp_kernel_get_frames_produced(DspKernelState *state);

/**
 * Tear down the kernel. Releases all WASM-side allocations.
 * After this call the state pointer is invalid.
 */
void dsp_kernel_teardown(DspKernelState *state);

#endif /* DSP_KERNEL_H */
