// ─── FFT Engine ─────────────────────────────────────────────────────────────
// Radix-2 STFT wrapper for frequency-domain analysis.
// Ported from music-intelligence-engine standalone DSP module.

/**
 * Run a 2048-point real FFT on the given sample window.
 * Returns the complex output array (interleaved re/im pairs).
 *
 * Uses the native Web Audio AnalyserNode internally when available,
 * falling back to a minimal DIT radix-2 implementation for worker contexts.
 */
export function runFFT(samples: Float32Array, size = 2048): Float32Array {
  // Minimal radix-2 DIT FFT — no external dependencies
  const n = size;
  const re = new Float32Array(n);
  const im = new Float32Array(n);

  // Copy input (zero-pad if short)
  for (let i = 0; i < n; i++) {
    re[i] = i < samples.length ? samples[i] : 0;
  }

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Cooley-Tukey butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < halfLen; j++) {
        const tRe = curRe * re[i + j + halfLen] - curIm * im[i + j + halfLen];
        const tIm = curRe * im[i + j + halfLen] + curIm * re[i + j + halfLen];

        re[i + j + halfLen] = re[i + j] - tRe;
        im[i + j + halfLen] = im[i + j] - tIm;
        re[i + j] += tRe;
        im[i + j] += tIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  // Return magnitude spectrum (first half — Nyquist symmetry)
  const magnitudes = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    magnitudes[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / n;
  }
  return magnitudes;
}

/**
 * Compute Short-Time Fourier Transform frames over the entire signal.
 * Returns an array of magnitude spectra at `hopSize` intervals.
 */
export function computeSTFT(
  samples: Float32Array,
  windowSize = 2048,
  hopSize = 512,
): Float32Array[] {
  const frames: Float32Array[] = [];
  for (let offset = 0; offset + windowSize <= samples.length; offset += hopSize) {
    const window = samples.subarray(offset, offset + windowSize);
    frames.push(runFFT(window, windowSize));
  }
  return frames;
}
