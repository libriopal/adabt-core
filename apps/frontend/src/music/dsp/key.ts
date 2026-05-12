// ─── Key Estimation ─────────────────────────────────────────────────────────
// Chromagram computation + Krumhansl-Kessler key profile correlation.
// Zero external dependencies — uses the local FFT engine.

import { runFFT } from './fft';

// ─── Krumhansl-Kessler Key Profiles ─────────────────────────────────────────
// Correlation weights for each pitch class (C, C#, D, ..., B)
// Source: Krumhansl, C.L. (1990) "Cognitive Foundations of Musical Pitch"

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Compute a 12-bin chromagram from raw PCM samples.
 * Maps FFT magnitude bins to pitch classes using log-frequency mapping.
 */
export function computeChromagram(
  samples: Float32Array,
  sampleRate: number,
  windowSize = 4096,
  hopSize = 2048,
): Float32Array {
  const chroma = new Float32Array(12);
  let frameCount = 0;

  for (let offset = 0; offset + windowSize <= samples.length; offset += hopSize) {
    const window = samples.subarray(offset, offset + windowSize);

    // Apply Hann window
    const windowed = new Float32Array(windowSize);
    for (let i = 0; i < windowSize; i++) {
      windowed[i] = window[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1)));
    }

    const magnitudes = runFFT(windowed, windowSize);
    const freqResolution = sampleRate / windowSize;

    // Map each FFT bin to a pitch class
    // Only consider frequencies from ~65Hz (C2) to ~4200Hz (C8)
    const minBin = Math.max(1, Math.ceil(65 / freqResolution));
    const maxBin = Math.min(magnitudes.length - 1, Math.floor(4200 / freqResolution));

    for (let bin = minBin; bin <= maxBin; bin++) {
      const freq = bin * freqResolution;
      // Convert frequency to MIDI note, then to pitch class
      const midi = 12 * Math.log2(freq / 440) + 69;
      const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
      chroma[pitchClass] += magnitudes[bin] * magnitudes[bin]; // energy weighting
    }

    frameCount++;
  }

  // Normalize
  if (frameCount > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= frameCount;
    }
  }

  // Normalize to sum = 1
  const sum = chroma.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= sum;
    }
  }

  return chroma;
}

/**
 * Pearson correlation between two arrays.
 */
function pearsonCorrelation(a: number[] | Float32Array, b: number[]): number {
  const n = a.length;
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }
  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  return den === 0 ? 0 : num / den;
}

/**
 * Rotate an array by `shift` positions (circular shift).
 */
function rotateProfile(profile: number[], shift: number): number[] {
  const n = profile.length;
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = profile[((i - shift) % n + n) % n];
  }
  return result;
}

/**
 * Estimate musical key from raw PCM samples using Krumhansl-Kessler profiles.
 * Returns key name (e.g. "C major", "A minor") and confidence (0-1).
 */
export function estimateKey(
  samples: Float32Array,
  sampleRate: number,
): { key: string; confidence: number } {
  const chroma = computeChromagram(samples, sampleRate);

  let bestKey = 'C major';
  let bestCorr = -Infinity;
  let secondCorr = -Infinity;

  // Test all 24 keys (12 major + 12 minor)
  for (let root = 0; root < 12; root++) {
    const majorProfile = rotateProfile(MAJOR_PROFILE, root);
    const minorProfile = rotateProfile(MINOR_PROFILE, root);

    const majorCorr = pearsonCorrelation(chroma, majorProfile);
    const minorCorr = pearsonCorrelation(chroma, minorProfile);

    if (majorCorr > bestCorr) {
      secondCorr = bestCorr;
      bestCorr = majorCorr;
      bestKey = `${NOTE_NAMES[root]} major`;
    } else if (majorCorr > secondCorr) {
      secondCorr = majorCorr;
    }

    if (minorCorr > bestCorr) {
      secondCorr = bestCorr;
      bestCorr = minorCorr;
      bestKey = `${NOTE_NAMES[root]} minor`;
    } else if (minorCorr > secondCorr) {
      secondCorr = minorCorr;
    }
  }

  // Confidence = gap between best and second-best correlation
  // Normalized to 0-1 range
  const confidence = Math.min(1, Math.max(0, (bestCorr - secondCorr) / (Math.abs(bestCorr) + 0.001)));

  return { key: bestKey, confidence };
}
