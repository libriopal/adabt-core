import type { MusicAnalysis } from './types';

const WAVEFORM_BUCKETS = 180;
const SPECTRUM_SIZE = 2048;
const SPECTRUM_BANDS = 48;

export function analyzeAudio(
  samples: Float32Array,
  sampleRate: number,
  duration: number,
  onProgress?: (progress: number, stage: string) => void,
): MusicAnalysis {
  onProgress?.(0.15, 'waveform');
  const waveform = buildWaveform(samples, WAVEFORM_BUCKETS);

  onProgress?.(0.35, 'dynamics');
  const dynamics = measureDynamics(samples);

  onProgress?.(0.55, 'spectrum');
  const spectrum = buildSpectrum(samples, sampleRate, SPECTRUM_SIZE, SPECTRUM_BANDS);

  onProgress?.(0.75, 'tempo');
  const bpm = estimateBPM(samples, sampleRate);

  onProgress?.(0.95, 'finalizing');
  return {
    bpm,
    sampleRate,
    duration,
    sampleCount: samples.length,
    peakAmplitude: dynamics.peakAmplitude,
    rms: dynamics.rms,
    spectralCentroid: dynamics.spectralCentroid,
    zeroCrossingRate: dynamics.zeroCrossingRate,
    waveform,
    spectrum,
  };
}

export function estimateBPM(samples: Float32Array, sampleRate: number): number {
  const windowSize = 1024;
  const energy: number[] = [];

  for (let i = 0; i < samples.length; i += windowSize) {
    let sum = 0;
    const available = Math.min(windowSize, samples.length - i);

    for (let j = 0; j < available; j++) {
      const sample = samples[i + j];
      sum += sample * sample;
    }

    energy.push(Math.sqrt(sum / Math.max(1, available)));
  }

  const mean = energy.reduce((sum, value) => sum + value, 0) / Math.max(1, energy.length);
  const threshold = mean * 1.35;
  const peaks: number[] = [];
  const minGap = Math.max(1, Math.floor((sampleRate * 0.25) / windowSize));

  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] <= threshold || energy[i] <= energy[i - 1] || energy[i] <= energy[i + 1]) {
      continue;
    }

    if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minGap) {
      peaks.push(i);
    } else if (energy[i] > energy[peaks[peaks.length - 1]]) {
      peaks[peaks.length - 1] = i;
    }
  }

  if (peaks.length < 2) return 0;

  const intervalCounts = new Map<number, number>();
  for (let i = 1; i < peaks.length; i++) {
    const seconds = ((peaks[i] - peaks[i - 1]) * windowSize) / sampleRate;
    if (seconds <= 0) continue;

    let bpm = 60 / seconds;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;

    const rounded = Math.round(bpm);
    intervalCounts.set(rounded, (intervalCounts.get(rounded) ?? 0) + 1);
  }

  let bestBpm = 0;
  let bestCount = 0;
  for (const [bpm, count] of intervalCounts) {
    if (count > bestCount) {
      bestBpm = bpm;
      bestCount = count;
    }
  }

  return bestBpm;
}

function buildWaveform(samples: Float32Array, buckets: number): number[] {
  const output: number[] = [];
  const bucketSize = Math.max(1, Math.floor(samples.length / buckets));

  for (let i = 0; i < buckets; i++) {
    const start = i * bucketSize;
    const end = Math.min(samples.length, start + bucketSize);
    let peak = 0;

    for (let j = start; j < end; j++) {
      peak = Math.max(peak, Math.abs(samples[j]));
    }

    output.push(round(peak));
  }

  return output;
}

function buildSpectrum(
  samples: Float32Array,
  sampleRate: number,
  fftSize: number,
  bands: number,
): number[] {
  const offset = Math.max(0, Math.floor((samples.length - fftSize) / 2));
  const magnitudes: number[] = [];

  for (let band = 0; band < bands; band++) {
    const frequency = logScaleFrequency(band, bands, 40, Math.min(16000, sampleRate / 2));
    const magnitude = goertzelMagnitude(samples, offset, fftSize, sampleRate, frequency);
    magnitudes.push(magnitude);
  }

  const max = Math.max(...magnitudes, 1e-6);
  return magnitudes.map(value => round(Math.min(1, value / max)));
}

function measureDynamics(samples: Float32Array) {
  let peakAmplitude = 0;
  let sumSquares = 0;
  let zeroCrossings = 0;
  let weightedFrequency = 0;
  let spectralWeight = 0;
  const stride = Math.max(1, Math.floor(samples.length / 4096));

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const abs = Math.abs(sample);
    peakAmplitude = Math.max(peakAmplitude, abs);
    sumSquares += sample * sample;

    if (i > 0 && Math.sign(samples[i - 1]) !== Math.sign(sample)) {
      zeroCrossings++;
    }
  }

  for (let i = 1; i < samples.length; i += stride) {
    const delta = Math.abs(samples[i] - samples[i - 1]);
    const frequencyEstimate = (i / samples.length) * 22050;
    weightedFrequency += frequencyEstimate * delta;
    spectralWeight += delta;
  }

  return {
    peakAmplitude: round(peakAmplitude),
    rms: round(Math.sqrt(sumSquares / Math.max(1, samples.length))),
    spectralCentroid: Math.round(weightedFrequency / Math.max(1e-6, spectralWeight)),
    zeroCrossingRate: round(zeroCrossings / Math.max(1, samples.length - 1)),
  };
}

function goertzelMagnitude(
  samples: Float32Array,
  offset: number,
  size: number,
  sampleRate: number,
  frequency: number,
): number {
  const k = Math.round((size * frequency) / sampleRate);
  const omega = (2 * Math.PI * k) / size;
  const coefficient = 2 * Math.cos(omega);
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = 0; i < size; i++) {
    const sourceIndex = offset + i;
    const sample = sourceIndex < samples.length ? samples[sourceIndex] : 0;
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, size - 1)));
    q0 = coefficient * q1 - q2 + sample * window;
    q2 = q1;
    q1 = q0;
  }

  return Math.sqrt(q1 * q1 + q2 * q2 - q1 * q2 * coefficient);
}

function logScaleFrequency(index: number, bands: number, min: number, max: number): number {
  const t = index / Math.max(1, bands - 1);
  return min * Math.pow(max / min, t);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
