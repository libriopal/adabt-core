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
 * This file is shared between dsp-kernel.c and the TS bridge types.
 */

#ifndef DSP_KERNEL_H
#define DSP_KERNEL_H

#include <stdint.h>

/* ─── SAB Header Layout ────────────────────────────────────────────────────── */

#define SAB_WRITE_HEAD_OFFSET  0   /* Uint32 @ byte 0 — monotonic, producer-owned */
#define SAB_READ_HEAD_OFFSET   1   /* Uint32 @ byte 4 — monotonic, consumer-owned */
#define SAB_HEADER_INTS        2   /* Number of int32 slots before data region     */
#define SAB_HEADER_BYTES       8   /* Byte offset where Float32 data begins        */

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
 * @param sab_ptr     Byte offset into WASM memory where the SAB is mapped.
 *                    The TS bridge imports the SAB as WASM linear memory.
 * @param capacity    Ring buffer capacity in samples (must be power of two).
 * @param sample_rate Audio sample rate (e.g. 48000).
 * @return            Pointer to the allocated DspKernelState, or 0 on failure.
 */
DspKernelState* dsp_kernel_init(uint32_t sab_ptr, uint32_t capacity, uint32_t sample_rate);

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
