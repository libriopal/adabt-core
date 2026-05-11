// ─── DSP Utilities ──────────────────────────────────────────────────────────
// Pure functions for spectral analysis, BPM detection, and feature extraction.
// All computation runs inside the analysis worker — never on the main thread.

// ─── Window Functions ───────────────────────────────────────────────────────

/** Pre-compute a Hann window of the given size */
export function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return w;
}

// ─── FFT (Radix-2 Cooley-Tukey) ────────────────────────────────────────────

/**
 * In-place radix-2 FFT. Input arrays are modified.
 * @param re Real part (length must be power of 2)
 * @param im Imaginary part (same length as re)
 */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
      tmp = im[i]; im[i] = im[j]; im[j] = tmp;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  // Butterfly stages
  for (let size = 2; size <= n; size *= 2) {
    const half = size >> 1;
    const angleStep = -2 * Math.PI / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const angle = angleStep * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const idx1 = i + k;
        const idx2 = i + k + half;
        const tr = wr * re[idx2] - wi * im[idx2];
        const ti = wr * im[idx2] + wi * re[idx2];
        re[idx2] = re[idx1] - tr;
        im[idx2] = im[idx1] - ti;
        re[idx1] += tr;
        im[idx1] += ti;
      }
    }
  }
}

/**
 * Compute magnitude spectrum from a windowed signal frame.
 * Returns only the first N/2+1 bins (positive frequencies).
 */
export function magnitudeSpectrum(
  frame: Float32Array,
  window: Float32Array,
  fftSize: number,
): Float32Array {
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);

  // Apply window and zero-pad
  const copyLen = Math.min(frame.length, window.length, fftSize);
  for (let i = 0; i < copyLen; i++) {
    re[i] = frame[i] * window[i];
  }

  fft(re, im);

  const bins = (fftSize >> 1) + 1;
  const mag = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mag;
}

// ─── STFT ───────────────────────────────────────────────────────────────────

export interface STFTFrame {
  time: number;
  magnitude: Float32Array;
}

/**
 * Short-Time Fourier Transform.
 * @param pcm Mono PCM audio
 * @param sampleRate Sample rate in Hz
 * @param fftSize FFT window size (power of 2)
 * @param hopSize Hop size in samples
 * @returns Array of STFT frames with time and magnitude spectrum
 */
export function stft(
  pcm: Float32Array,
  sampleRate: number,
  fftSize: number = 2048,
  hopSize: number = 512,
): STFTFrame[] {
  const window = hannWindow(fftSize);
  const frames: STFTFrame[] = [];
  const frame = new Float32Array(fftSize);

  for (let start = 0; start + fftSize <= pcm.length; start += hopSize) {
    // Extract frame
    for (let i = 0; i < fftSize; i++) {
      frame[i] = pcm[start + i];
    }

    frames.push({
      time: (start + fftSize / 2) / sampleRate,
      magnitude: magnitudeSpectrum(frame, window, fftSize),
    });
  }

  return frames;
}

// ─── Spectral Features ──────────────────────────────────────────────────────

/** Root mean square energy of a signal frame */
export function rms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += frame[i] * frame[i];
  }
  return Math.sqrt(sum / frame.length);
}

/** Spectral centroid — weighted mean frequency */
export function spectralCentroid(magnitude: Float32Array, sampleRate: number, fftSize: number): number {
  let weightedSum = 0;
  let magSum = 0;
  const binHz = sampleRate / fftSize;
  for (let i = 0; i < magnitude.length; i++) {
    weightedSum += i * binHz * magnitude[i];
    magSum += magnitude[i];
  }
  return magSum > 0 ? weightedSum / magSum : 0;
}

/**
 * Spectral flux — half-wave rectified difference between consecutive magnitude spectra.
 * Positive flux only (onsets, not offsets).
 */
export function spectralFlux(current: Float32Array, previous: Float32Array): number {
  let flux = 0;
  const len = Math.min(current.length, previous.length);
  for (let i = 0; i < len; i++) {
    const diff = current[i] - previous[i];
    if (diff > 0) flux += diff;
  }
  return flux;
}

// ─── Chromagram ─────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Compute a 12-bin chromagram from a magnitude spectrum.
 * Maps each FFT bin to its nearest pitch class.
 */
export function chromagram(magnitude: Float32Array, sampleRate: number, fftSize: number): Float32Array {
  const chroma = new Float32Array(12);
  const binHz = sampleRate / fftSize;

  // Start from bin 1 (skip DC) and limit to meaningful range
  const minBin = Math.max(1, Math.round(27.5 / binHz));  // A0 ≈ 27.5 Hz
  const maxBin = Math.min(magnitude.length - 1, Math.round(4186 / binHz)); // C8 ≈ 4186 Hz

  for (let i = minBin; i <= maxBin; i++) {
    const freq = i * binHz;
    if (freq <= 0) continue;
    // Convert frequency to pitch class (semitone mod 12)
    const midiNote = 12 * Math.log2(freq / 440) + 69;
    const pitchClass = ((Math.round(midiNote) % 12) + 12) % 12;
    chroma[pitchClass] += magnitude[i] * magnitude[i]; // Energy weighting
  }

  // Normalize
  let maxVal = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > maxVal) maxVal = chroma[i];
  }
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxVal;
    }
  }

  return chroma;
}

// ─── Key Estimation (Krumhansl-Kessler) ─────────────────────────────────────

// Major and minor key profiles (Krumhansl-Kessler, normalized)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(a: number[], b: Float32Array): number {
  let sumAB = 0, sumA = 0, sumB = 0, sumA2 = 0, sumB2 = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) {
    sumAB += a[i] * b[i];
    sumA += a[i];
    sumB += b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }
  const denom = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  return denom > 0 ? (n * sumAB - sumA * sumB) / denom : 0;
}

/**
 * Estimate musical key from aggregate chromagram.
 * Returns e.g. "C major" or "A minor".
 */
export function estimateKey(aggregateChroma: Float32Array): string {
  let bestCorr = -Infinity;
  let bestKey = 'C major';

  for (let shift = 0; shift < 12; shift++) {
    // Rotate chroma to test each key
    const rotated = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
      rotated[i] = aggregateChroma[(i + shift) % 12];
    }

    const majorCorr = correlate(MAJOR_PROFILE, rotated);
    if (majorCorr > bestCorr) {
      bestCorr = majorCorr;
      bestKey = `${NOTE_NAMES[shift]} major`;
    }

    const minorCorr = correlate(MINOR_PROFILE, rotated);
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr;
      bestKey = `${NOTE_NAMES[shift]} minor`;
    }
  }

  return bestKey;
}

// ─── BPM Detection (Autocorrelation) ────────────────────────────────────────

/**
 * Detect BPM from an onset strength envelope using autocorrelation.
 * @param onsetEnvelope Onset strength values (one per STFT frame)
 * @param frameRate Frames per second (sampleRate / hopSize)
 * @param minBPM Minimum BPM to detect
 * @param maxBPM Maximum BPM to detect
 */
export function detectBPM(
  onsetEnvelope: Float32Array,
  frameRate: number,
  minBPM: number = 60,
  maxBPM: number = 200,
): number {
  const n = onsetEnvelope.length;
  if (n < 2) return 120; // default

  // Normalize onset envelope
  let mean = 0;
  for (let i = 0; i < n; i++) mean += onsetEnvelope[i];
  mean /= n;

  const normalized = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    normalized[i] = onsetEnvelope[i] - mean;
  }

  // Autocorrelation over BPM range
  const minLag = Math.floor(frameRate * 60 / maxBPM);
  const maxLag = Math.ceil(frameRate * 60 / minBPM);

  let bestCorr = -Infinity;
  let bestLag = minLag;

  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let corr = 0;
    const len = n - lag;
    for (let i = 0; i < len; i++) {
      corr += normalized[i] * normalized[i + lag];
    }
    corr /= len;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return (frameRate * 60) / bestLag;
}

/**
 * Build a beat grid from BPM and onset envelope.
 * Finds the best phase alignment of evenly-spaced beats.
 */
export function buildBeatGrid(
  bpm: number,
  duration: number,
  onsetEnvelope: Float32Array,
  frameRate: number,
): number[] {
  if (bpm <= 0 || duration <= 0) return [];

  const beatInterval = 60 / bpm; // seconds between beats
  const numBeats = Math.floor(duration / beatInterval);
  if (numBeats < 2) return [];

  // Find best phase offset by maximizing onset energy at beat positions
  const searchSteps = 100;
  const stepSize = beatInterval / searchSteps;
  let bestPhase = 0;
  let bestEnergy = -Infinity;

  for (let s = 0; s < searchSteps; s++) {
    const phase = s * stepSize;
    let energy = 0;
    for (let b = 0; b < numBeats; b++) {
      const beatTime = phase + b * beatInterval;
      const frameIdx = Math.round(beatTime * frameRate);
      if (frameIdx >= 0 && frameIdx < onsetEnvelope.length) {
        energy += onsetEnvelope[frameIdx];
      }
    }
    if (energy > bestEnergy) {
      bestEnergy = energy;
      bestPhase = phase;
    }
  }

  // Generate grid
  const beats: number[] = [];
  for (let b = 0; b < numBeats; b++) {
    const time = bestPhase + b * beatInterval;
    if (time <= duration) {
      beats.push(time);
    }
  }

  return beats;
}

export { NOTE_NAMES };
