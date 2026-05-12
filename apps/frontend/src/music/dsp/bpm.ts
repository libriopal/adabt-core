// ─── BPM Detection ──────────────────────────────────────────────────────────
// Energy-based onset detection + autocorrelation BPM estimator.
// Ported from music-intelligence-engine standalone DSP module and enhanced
// with autocorrelation for more reliable tempo detection.

/**
 * Estimate BPM from raw PCM samples using energy-based onset detection.
 * Fast first-pass estimator — O(n) with minimal allocations.
 */
export function estimateBPM(samples: Float32Array, sampleRate: number): number {
  const windowSize = 1024;
  const energy: number[] = [];

  // Compute RMS energy per window
  for (let i = 0; i < samples.length; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize && i + j < samples.length; j++) {
      const s = samples[i + j];
      sum += s * s;
    }
    energy.push(Math.sqrt(sum / windowSize));
  }

  // Find peaks (onsets)
  const peaks: number[] = [];
  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] > energy[i - 1] && energy[i] > energy[i + 1] && energy[i] > 0.05) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) return 0;

  // Average inter-onset interval
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const secondsPerBeat = (avgInterval * windowSize) / sampleRate;
  const bpm = 60 / secondsPerBeat;

  return Math.round(bpm);
}

/**
 * Autocorrelation-based BPM estimator — more accurate for complex signals.
 * Operates on energy envelope, finds strongest periodicity in 60–200 BPM range.
 */
export function estimateBPMAutocorrelation(
  samples: Float32Array,
  sampleRate: number,
  minBPM = 60,
  maxBPM = 200,
): { bpm: number; confidence: number } {
  const windowSize = 1024;
  const hopSize = 512;

  // Build energy envelope
  const envelopeLength = Math.floor((samples.length - windowSize) / hopSize);
  if (envelopeLength < 2) return { bpm: 0, confidence: 0 };

  const envelope = new Float32Array(envelopeLength);
  for (let i = 0; i < envelopeLength; i++) {
    const offset = i * hopSize;
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const s = samples[offset + j];
      sum += s * s;
    }
    envelope[i] = Math.sqrt(sum / windowSize);
  }

  // Envelope sample rate
  const envelopeSR = sampleRate / hopSize;

  // Autocorrelation over BPM range
  const minLag = Math.floor((60 / maxBPM) * envelopeSR);
  const maxLag = Math.ceil((60 / minBPM) * envelopeSR);
  const clampedMaxLag = Math.min(maxLag, envelopeLength - 1);

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= clampedMaxLag; lag++) {
    let corr = 0;
    const count = envelopeLength - lag;
    for (let i = 0; i < count; i++) {
      corr += envelope[i] * envelope[i + lag];
    }
    corr /= count;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Compute BPM from best lag
  const bpm = (60 * envelopeSR) / bestLag;

  // Confidence = ratio of best correlation to zero-lag autocorrelation
  let zeroCorr = 0;
  for (let i = 0; i < envelopeLength; i++) {
    zeroCorr += envelope[i] * envelope[i];
  }
  zeroCorr /= envelopeLength;
  const confidence = zeroCorr > 0 ? bestCorr / zeroCorr : 0;

  return { bpm: Math.round(bpm), confidence: Math.min(1, Math.max(0, confidence)) };
}
