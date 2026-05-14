// ─── Analysis Worker ────────────────────────────────────────────────────────
// Performs spectral analysis, BPM detection, chromagram, and key estimation
// on decoded PCM audio. All heavy DSP runs here — never on the main thread.
//
// Pipeline: PCM → STFT → [spectral features, onset envelope] → BPM → chroma → key → beat grid
// Reports progress per stage. Supports cancellation between stages.

import type {
  AnalysisWorkerInbound,
  AnalyzeProgress,
  AnalyzeComplete,
  AnalyzeError,
  TelemetryEvent,
} from '../types/worker-messages';

import {
  stft,
  rms,
  spectralCentroid,
  spectralFlux,
  chromagram,
  estimateKey,
  detectBPM,
  buildBeatGrid,
} from '../lib/dsp';

// ─── Cancellation ───────────────────────────────────────────────────────────

const cancelledSeqIds = new Set<number>();

function isCancelled(seqId: number): boolean {
  return cancelledSeqIds.has(seqId);
}

// ─── Message Helpers ────────────────────────────────────────────────────────

function sendProgress(
  seqId: number,
  stage: AnalyzeProgress['stage'],
  percent: number,
): void {
  const msg: AnalyzeProgress = { type: 'analyze:progress', seqId, stage, percent };
  self.postMessage(msg);
}

function sendComplete(
  seqId: number,
  bpm: number,
  key: string,
  beatGrid: number[],
  frames: AnalyzeComplete['frames'],
): void {
  const msg: AnalyzeComplete = {
    type: 'analyze:complete',
    seqId,
    bpm,
    key,
    beatGrid,
    frames,
  };
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

// ─── Analysis Pipeline ──────────────────────────────────────────────────────

async function analyzeAudio(
  seqId: number,
  pcmData: Float32Array,
  sampleRate: number,
  _channels: number,
): Promise<void> {
  const startTime = performance.now();
  const duration = pcmData.length / sampleRate;

  sendTelemetry('analysis:start', { samples: pcmData.length, sampleRate, duration });

  try {
    // ─── Stage 1: STFT ────────────────────────────────────────────────────
    sendProgress(seqId, 'fft', 0);

    const FFT_SIZE = 2048;
    const HOP_SIZE = 512;
    const frameRate = sampleRate / HOP_SIZE;

    const stftFrames = stft(pcmData, sampleRate, FFT_SIZE, HOP_SIZE);
    const numFrames = stftFrames.length;

    sendTelemetry('analysis:stft_done', {
      frames: numFrames,
      frameRate,
      ms: performance.now() - startTime,
    });

    if (isCancelled(seqId)) return;
    sendProgress(seqId, 'fft', 100);

    // ─── Stage 2: Spectral Features & Onset Envelope ──────────────────────
    sendProgress(seqId, 'bpm', 0);

    const onsetEnvelope = new Float32Array(numFrames);
    const analysisFrames: AnalyzeComplete['frames'] = [];

    // Downsample analysis frames to ~30fps for UI consumption
    const targetFps = 30;
    const frameSkip = Math.max(1, Math.round(frameRate / targetFps));

    let prevMag: Float32Array | null = null;

    for (let i = 0; i < numFrames; i++) {
      const frame = stftFrames[i];
      const mag = frame.magnitude;

      // Spectral flux for onset detection (every frame)
      const flux = prevMag ? spectralFlux(mag, prevMag) : 0;
      onsetEnvelope[i] = flux;
      prevMag = mag;

      // Downsampled features for UI
      if (i % frameSkip === 0) {
        // Compute RMS from PCM directly for this frame's time window
        const pcmStart = Math.max(0, Math.floor(frame.time * sampleRate) - FFT_SIZE / 2);
        const pcmEnd = Math.min(pcmData.length, pcmStart + FFT_SIZE);
        let frameRms = 0;
        for (let s = pcmStart; s < pcmEnd; s++) {
          frameRms += pcmData[s] * pcmData[s];
        }
        frameRms = Math.sqrt(frameRms / (pcmEnd - pcmStart));

        analysisFrames.push({
          time: frame.time,
          rms: frameRms,
          spectralCentroid: spectralCentroid(mag, sampleRate, FFT_SIZE),
          spectralFlux: flux,
        });
      }

      // Report progress every 10%
      if (i % Math.max(1, Math.floor(numFrames / 10)) === 0) {
        sendProgress(seqId, 'bpm', Math.round((i / numFrames) * 50));
      }
    }

    if (isCancelled(seqId)) return;

    // ─── Stage 3: BPM Detection ───────────────────────────────────────────
    sendProgress(seqId, 'bpm', 50);

    const bpm = detectBPM(onsetEnvelope, frameRate);

    sendTelemetry('analysis:bpm_detected', { bpm, ms: performance.now() - startTime });

    if (isCancelled(seqId)) return;
    sendProgress(seqId, 'bpm', 100);

    // ─── Stage 4: Chromagram & Key ────────────────────────────────────────
    sendProgress(seqId, 'chroma', 0);

    // Aggregate chromagram across all frames
    const aggregateChroma = new Float32Array(12);
    const chromaSampleInterval = Math.max(1, Math.floor(numFrames / 200)); // Sample ~200 frames

    for (let i = 0; i < numFrames; i += chromaSampleInterval) {
      const chroma = chromagram(stftFrames[i].magnitude, sampleRate, FFT_SIZE);
      for (let c = 0; c < 12; c++) {
        aggregateChroma[c] += chroma[c];
      }

      if (i % Math.max(1, Math.floor(numFrames / 5)) === 0) {
        sendProgress(seqId, 'chroma', Math.round((i / numFrames) * 100));
      }
    }

    // Normalize aggregate
    let maxChroma = 0;
    for (let c = 0; c < 12; c++) {
      if (aggregateChroma[c] > maxChroma) maxChroma = aggregateChroma[c];
    }
    if (maxChroma > 0) {
      for (let c = 0; c < 12; c++) {
        aggregateChroma[c] /= maxChroma;
      }
    }

    const key = estimateKey(aggregateChroma);

    sendTelemetry('analysis:key_estimated', { key, ms: performance.now() - startTime });

    if (isCancelled(seqId)) return;
    sendProgress(seqId, 'chroma', 100);

    // ─── Stage 5: Beat Grid ───────────────────────────────────────────────
    sendProgress(seqId, 'transients', 0);

    const beatGrid = buildBeatGrid(bpm, duration, onsetEnvelope, frameRate);

    sendTelemetry('analysis:beat_grid', {
      beats: beatGrid.length,
      bpm,
      ms: performance.now() - startTime,
    });

    if (isCancelled(seqId)) return;
    sendProgress(seqId, 'transients', 100);

    // ─── Done ─────────────────────────────────────────────────────────────
    const totalMs = performance.now() - startTime;
    sendTelemetry('analysis:complete', {
      totalMs,
      bpm,
      key,
      beats: beatGrid.length,
      frames: analysisFrames.length,
      throughputSamplesPerSec: pcmData.length / (totalMs / 1000),
    });

    sendComplete(seqId, bpm, key, beatGrid, analysisFrames);

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
      analyzeAudio(msg.seqId, msg.pcmData, msg.sampleRate, msg.channels);
      break;

    case 'cancel':
      cancelledSeqIds.add(msg.seqId);
      sendTelemetry('analysis:cancelled', { seqId: msg.seqId });
      break;
  }
};
