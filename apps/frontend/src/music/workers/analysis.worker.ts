// ─── Analysis Worker ────────────────────────────────────────────────────────
// Runs DSP analysis off the main thread: FFT spectral frames, BPM detection,
// key estimation, and phase-aligned beat grid.
//
// Staged progress reporting so the UI can show incremental analysis state.
// Cancellable via seqId matching.

import type {
  AnalysisWorkerInbound,
  AnalyzeProgress,
  AnalyzeComplete,
  AnalyzeError,
  TelemetryEvent,
} from '../types/worker-messages';
import { runFFT } from '../dsp/fft';
import { estimateBPMAutocorrelation } from '../dsp/bpm';
import { estimateKey } from '../dsp/key';

const cancelledSeqIds = new Set<number>();

function isCancelled(seqId: number): boolean {
  return cancelledSeqIds.has(seqId);
}

function sendProgress(seqId: number, stage: AnalyzeProgress['stage'], percent: number): void {
  const msg: AnalyzeProgress = { type: 'analyze:progress', seqId, stage, percent };
  self.postMessage(msg);
}

function sendComplete(seqId: number, result: Omit<AnalyzeComplete, 'type' | 'seqId'>): void {
  const msg: AnalyzeComplete = { type: 'analyze:complete', seqId, ...result };
  self.postMessage(msg);
}

function sendError(seqId: number, error: string): void {
  const msg: AnalyzeError = { type: 'analyze:error', seqId, error };
  self.postMessage(msg);
}

function sendTelemetry(event: string, data: Record<string, unknown>): void {
  const msg: TelemetryEvent = {
    type: 'telemetry',
    worker: 'analysis',
    event,
    data,
    timestamp: performance.now(),
  };
  self.postMessage(msg);
}

// ─── Spectral Frame Analysis ────────────────────────────────────────────────

interface SpectralFrame {
  time: number;
  rms: number;
  spectralCentroid: number;
  spectralFlux: number;
}

function computeSpectralFrames(
  samples: Float32Array,
  sampleRate: number,
  seqId: number,
): SpectralFrame[] {
  const windowSize = 2048;
  // Target ~30fps for analysis frames
  const targetFps = 30;
  const hopSize = Math.max(windowSize, Math.floor(sampleRate / targetFps));
  
  const frames: SpectralFrame[] = [];
  let prevMagnitudes: Float32Array | null = null;
  const numFrames = Math.floor((samples.length - windowSize) / hopSize);

  for (let i = 0; i < numFrames; i++) {
    if (isCancelled(seqId)) return frames;

    const offset = i * hopSize;
    const window = samples.subarray(offset, offset + windowSize);

    // Apply Hann window
    const windowed = new Float32Array(windowSize);
    for (let j = 0; j < windowSize; j++) {
      windowed[j] = window[j] * (0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (windowSize - 1)));
    }

    const magnitudes = runFFT(windowed, windowSize);
    const time = offset / sampleRate;

    // RMS
    let rmsSum = 0;
    for (let j = 0; j < windowSize; j++) {
      rmsSum += window[j] * window[j];
    }
    const rms = Math.sqrt(rmsSum / windowSize);

    // Spectral centroid (weighted mean frequency)
    let weightedSum = 0;
    let magSum = 0;
    const freqRes = sampleRate / windowSize;
    for (let j = 0; j < magnitudes.length; j++) {
      const freq = j * freqRes;
      weightedSum += freq * magnitudes[j];
      magSum += magnitudes[j];
    }
    const spectralCentroid = magSum > 0 ? weightedSum / magSum : 0;

    // Spectral flux (change from previous frame)
    let flux = 0;
    if (prevMagnitudes) {
      for (let j = 0; j < magnitudes.length; j++) {
        const diff = magnitudes[j] - prevMagnitudes[j];
        flux += diff > 0 ? diff * diff : 0; // Half-wave rectification
      }
      flux = Math.sqrt(flux);
    }
    prevMagnitudes = magnitudes;

    frames.push({ time, rms, spectralCentroid, spectralFlux: flux });

    // Report progress every 10%
    if (i % Math.max(1, Math.floor(numFrames / 10)) === 0) {
      sendProgress(seqId, 'fft', (i / numFrames) * 100);
    }
  }

  return frames;
}

// ─── Beat Grid ──────────────────────────────────────────────────────────────

function buildBeatGrid(bpm: number, duration: number): number[] {
  if (bpm <= 0 || duration <= 0) return [];

  const beatInterval = 60 / bpm;
  const grid: number[] = [];

  // Start from the first beat — assume beat 1 at or near t=0
  // A more advanced version would use onset detection to find the first beat
  for (let t = 0; t < duration; t += beatInterval) {
    grid.push(t);
  }

  return grid;
}

// ─── Main Analysis Pipeline ─────────────────────────────────────────────────

async function analyze(
  seqId: number,
  pcmData: Float32Array,
  sampleRate: number,
): Promise<void> {
  const startTime = performance.now();
  sendTelemetry('analysis:start', { samples: pcmData.length, sampleRate });

  try {
    // Stage 1: FFT spectral frames
    sendProgress(seqId, 'fft', 0);
    const frames = computeSpectralFrames(pcmData, sampleRate, seqId);
    if (isCancelled(seqId)) return;
    sendTelemetry('analysis:fft:done', { frames: frames.length });

    // Stage 2: BPM detection
    sendProgress(seqId, 'bpm', 0);
    const bpmResult = estimateBPMAutocorrelation(pcmData, sampleRate);
    if (isCancelled(seqId)) return;
    sendProgress(seqId, 'bpm', 100);
    sendTelemetry('analysis:bpm:done', { bpm: bpmResult.bpm, confidence: bpmResult.confidence });

    // Stage 3: Key estimation
    sendProgress(seqId, 'chroma', 0);
    const keyResult = estimateKey(pcmData, sampleRate);
    if (isCancelled(seqId)) return;
    sendProgress(seqId, 'chroma', 100);
    sendTelemetry('analysis:key:done', { key: keyResult.key, confidence: keyResult.confidence });

    // Stage 4: Beat grid
    const duration = pcmData.length / sampleRate;
    const beatGrid = buildBeatGrid(bpmResult.bpm, duration);
    if (isCancelled(seqId)) return;

    sendComplete(seqId, {
      bpm: bpmResult.bpm,
      bpmConfidence: bpmResult.confidence,
      key: keyResult.key,
      keyConfidence: keyResult.confidence,
      beatGrid,
      frames,
    });

    sendTelemetry('analysis:finish', {
      totalMs: performance.now() - startTime,
      bpm: bpmResult.bpm,
      key: keyResult.key,
      beatGridBeats: beatGrid.length,
    });
  } catch (err) {
    sendError(seqId, err instanceof Error ? err.message : String(err));
    sendTelemetry('analysis:error', { error: String(err) });
  }
}

// ─── Message Handler ────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<AnalysisWorkerInbound>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'analyze:start':
      analyze(msg.seqId, msg.pcmData, msg.sampleRate);
      break;

    case 'cancel':
      cancelledSeqIds.add(msg.seqId);
      sendTelemetry('analysis:cancelled', { seqId: msg.seqId });
      break;
  }
};
