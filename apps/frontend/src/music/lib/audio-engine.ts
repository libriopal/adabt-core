// ─── Audio Engine ───────────────────────────────────────────────────────────
// Orchestrates decode, playback, and real-time analysis visualization.
// Main thread owns AudioContext for playback.
// Workers own all DSP/decode compute.

import { workerManager, nextSeqId } from './worker-manager';
import type { AudioFileInfo, PlaybackState, VFXSnapshot } from '../types/audio';
import type { DecodeWorkerOutbound } from '../types/worker-messages';

export type AudioEngineListener = (state: AudioEngineState) => void;

export interface AudioEngineState {
  file: AudioFileInfo | null;
  playback: PlaybackState;
  decodeProgress: number;
  pcmChunks: Float32Array[];
  totalDecodedSamples: number;
  waveformPreview: Float32Array | null;
  vfxSnapshot: VFXSnapshot | null;
  telemetry: Array<{ event: string; data: Record<string, unknown>; timestamp: number }>;
}

const INITIAL_STATE: AudioEngineState = {
  file: null,
  playback: {
    status: 'idle',
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  },
  decodeProgress: 0,
  pcmChunks: [],
  totalDecodedSamples: 0,
  waveformPreview: null,
  vfxSnapshot: null,
  telemetry: [],
};

export class AudioEngine {
  private state: AudioEngineState = { ...INITIAL_STATE };
  private listeners = new Set<AudioEngineListener>();
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime = 0;
  private startOffset = 0;
  private rafId: number | null = null;
  private currentSeqId: number | null = null;

  // Incremental waveform preview state
  private previewBuckets: Float32Array | null = null;
  private previewBucketCounts: Uint32Array | null = null;
  private waveformSamplesProcessed = 0;
  private static readonly PREVIEW_POINTS = 2000;

  constructor() {
    this.initWorkers();
  }

  // ─── Worker Setup ───────────────────────────────────────────────────────

  private initWorkers(): void {
    const decodeWorker = new Worker(
      new URL('../workers/decode.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerManager.register('decode', decodeWorker);

    workerManager.subscribe('decode', (msg) => {
      this.handleDecodeMessage(msg as DecodeWorkerOutbound);
    });

    workerManager.onTelemetry((event) => {
      this.state.telemetry = [
        ...this.state.telemetry.slice(-49),
        { event: event.event, data: event.data, timestamp: event.timestamp },
      ];
      this.notify();
    });
  }

  private handleDecodeMessage(msg: DecodeWorkerOutbound): void {
    if ('seqId' in msg && msg.seqId !== this.currentSeqId) return;

    switch (msg.type) {
      case 'decode:progress':
        this.state.decodeProgress = msg.percent;
        this.notify();
        break;

      case 'decode:chunk':
        // Mutate array in-place instead of cloning on every chunk
        this.state.pcmChunks.push(msg.pcmData);
        this.state.totalDecodedSamples += msg.pcmData.length;
        // Incrementally process only the new chunk into the waveform preview
        this.appendToWaveformPreview(msg.pcmData);
        this.notify();
        break;

      case 'decode:complete':
        this.state.decodeProgress = 100;
        this.state.playback = {
          ...this.state.playback,
          status: 'paused',
          duration: msg.duration,
        };
        if (this.state.file) {
          this.state.file.duration = msg.duration;
          this.state.file.sampleRate = msg.sampleRate;
          this.state.file.channels = msg.channels;
        }
        // Final exact waveform rebuild now that all samples are in
        this.buildFinalWaveformPreview();
        this.preparePlayback(msg.sampleRate, msg.channels, msg.totalSamples);
        this.notify();
        break;

      case 'decode:error':
        this.state.playback = { ...this.state.playback, status: 'error' };
        console.error('[AudioEngine] Decode error:', msg.error);
        this.notify();
        break;
    }
  }

  // ─── File Loading ─────────────────────────────────────────────────────

  async loadFile(file: File): Promise<void> {
    // Cancel any existing decode
    if (this.currentSeqId !== null) {
      workerManager.cancel('decode');
    }
    this.stop();

    // Reset state
    this.state = {
      ...INITIAL_STATE,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
      playback: { ...INITIAL_STATE.playback, status: 'loading' },
      telemetry: this.state.telemetry,
    };
    this.resetWaveformPreview();
    // Assign seqId before async work to prevent race condition
    // when two quick file selections resolve out of order
    const seqId = nextSeqId();
    this.currentSeqId = seqId;
    this.notify();

    // Read file and send to decode worker
    const arrayBuffer = await file.arrayBuffer();

    // Check we haven't been superseded during the await
    if (this.currentSeqId !== seqId) return;

    workerManager.send('decode', {
      type: 'decode:start',
      seqId,
      fileData: arrayBuffer,
      fileName: file.name,
    }, [arrayBuffer]);
  }

  // ─── Playback ─────────────────────────────────────────────────────────

  private async preparePlayback(sampleRate: number, channels: number, totalSamples: number): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate });
    }

    // Assemble full PCM buffer from chunks
    const fullPcm = new Float32Array(this.state.totalDecodedSamples);
    let offset = 0;
    for (const chunk of this.state.pcmChunks) {
      fullPcm.set(chunk, offset);
      offset += chunk.length;
    }

    // Create AudioBuffer for playback (mono for now)
    this.audioBuffer = this.audioContext.createBuffer(1, fullPcm.length, sampleRate);
    this.audioBuffer.getChannelData(0).set(fullPcm);

    // Setup audio graph
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.state.playback.volume;

    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);
  }

  play(): void {
    if (!this.audioContext || !this.audioBuffer || !this.gainNode) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Stop existing source if playing
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch { /* already stopped */ }
    }

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);

    this.sourceNode.onended = () => {
      if (this.state.playback.status === 'playing') {
        this.state.playback = { ...this.state.playback, status: 'paused', currentTime: 0 };
        this.startOffset = 0;
        this.stopRaf();
        this.notify();
      }
    };

    this.startTime = this.audioContext.currentTime;
    this.sourceNode.start(0, this.startOffset);

    this.state.playback = { ...this.state.playback, status: 'playing' };
    this.notify();
    this.startRaf();
  }

  pause(): void {
    if (!this.audioContext || !this.sourceNode) return;

    this.startOffset = this.audioContext.currentTime - this.startTime + this.startOffset;
    try { this.sourceNode.stop(); } catch { /* already stopped */ }
    this.sourceNode = null;

    this.state.playback = {
      ...this.state.playback,
      status: 'paused',
      currentTime: this.startOffset,
    };
    this.stopRaf();
    this.notify();
  }

  stop(): void {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch { /* already stopped */ }
      this.sourceNode = null;
    }
    this.startOffset = 0;
    this.state.playback = { ...this.state.playback, status: 'paused', currentTime: 0 };
    this.stopRaf();
    this.notify();
  }

  seek(time: number): void {
    const wasPlaying = this.state.playback.status === 'playing';
    if (wasPlaying) {
      if (this.sourceNode) {
        try { this.sourceNode.stop(); } catch { /* already stopped */ }
        this.sourceNode = null;
      }
    }
    this.startOffset = Math.max(0, Math.min(time, this.state.playback.duration));
    this.state.playback = { ...this.state.playback, currentTime: this.startOffset };
    this.notify();
    if (wasPlaying) {
      this.play();
    }
  }

  setVolume(volume: number): void {
    this.state.playback = { ...this.state.playback, volume };
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
    this.notify();
  }

  // ─── RAF Loop (VFX Snapshot) ──────────────────────────────────────────

  private startRaf(): void {
    if (this.rafId !== null) return;

    const spectrumBuffer = new Uint8Array(this.analyserNode?.frequencyBinCount ?? 1024);
    const waveformBuffer = new Uint8Array(this.analyserNode?.fftSize ?? 2048);

    const tick = () => {
      if (!this.audioContext || !this.analyserNode) return;

      const currentTime = this.audioContext.currentTime - this.startTime + this.startOffset;
      this.state.playback = { ...this.state.playback, currentTime };

      // Read analyser data
      this.analyserNode.getByteFrequencyData(spectrumBuffer);
      this.analyserNode.getByteTimeDomainData(waveformBuffer);

      // Convert to normalized Float32
      const spectrum = new Float32Array(spectrumBuffer.length);
      for (let i = 0; i < spectrumBuffer.length; i++) {
        spectrum[i] = spectrumBuffer[i] / 255;
      }
      const waveform = new Float32Array(waveformBuffer.length);
      let rms = 0;
      let peak = 0;
      for (let i = 0; i < waveformBuffer.length; i++) {
        const val = (waveformBuffer[i] - 128) / 128;
        waveform[i] = val;
        rms += val * val;
        peak = Math.max(peak, Math.abs(val));
      }
      rms = Math.sqrt(rms / waveformBuffer.length);

      this.state.vfxSnapshot = {
        time: currentTime,
        spectrum,
        waveform,
        rms,
        peak,
        beatPhase: 0, // Phase 2 will compute this from BPM
      };

      this.notify();
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private stopRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ─── Waveform Preview (Incremental) ────────────────────────────────────

  private resetWaveformPreview(): void {
    this.previewBuckets = new Float32Array(AudioEngine.PREVIEW_POINTS);
    this.previewBucketCounts = new Uint32Array(AudioEngine.PREVIEW_POINTS);
    this.waveformSamplesProcessed = 0;
    this.state.waveformPreview = null;
  }

  /**
   * Incrementally fold a new PCM chunk into the preview buckets.
   * Only the new chunk is scanned — O(chunkLength) per call, not O(totalSamples).
   * The bucket mapping uses an *estimated* final sample count derived from the
   * file's expected duration (or falls back to a generous over-estimate).
   * On decode:complete we do one final rebuild so the mapping is exact.
   */
  private appendToWaveformPreview(chunk: Float32Array): void {
    const N = AudioEngine.PREVIEW_POINTS;
    if (!this.previewBuckets || !this.previewBucketCounts) {
      this.previewBuckets = new Float32Array(N);
      this.previewBucketCounts = new Uint32Array(N);
    }

    // Estimate total samples from file duration hint or current count
    const estimatedTotal = this.state.file?.duration
      ? Math.ceil(this.state.file.duration * 44100) // rough estimate
      : this.state.totalDecodedSamples * 2; // double current as fallback

    const samplesPerBucket = Math.max(1, Math.floor(estimatedTotal / N));

    for (let i = 0; i < chunk.length; i++) {
      const globalIdx = this.waveformSamplesProcessed + i;
      const bucket = Math.min(N - 1, Math.floor(globalIdx / samplesPerBucket));
      const absVal = Math.abs(chunk[i]);
      if (absVal > this.previewBuckets[bucket]) {
        this.previewBuckets[bucket] = absVal;
      }
      this.previewBucketCounts[bucket]++;
    }

    this.waveformSamplesProcessed += chunk.length;

    // Expose a copy to consumers (the Float32Array is mutable internally)
    this.state.waveformPreview = new Float32Array(this.previewBuckets);
  }

  /**
   * Final exact waveform build on decode:complete.
   * Called once — O(totalSamples) total, not per-chunk.
   */
  private buildFinalWaveformPreview(): void {
    const N = AudioEngine.PREVIEW_POINTS;
    const totalSamples = this.state.totalDecodedSamples;
    if (totalSamples === 0) return;

    const samplesPerBucket = Math.max(1, Math.floor(totalSamples / N));
    const numPoints = Math.min(N, totalSamples);
    const preview = new Float32Array(numPoints);

    let sampleIdx = 0;
    let chunkIdx = 0;
    let chunkOffset = 0;

    for (let p = 0; p < numPoints; p++) {
      let maxAbs = 0;
      for (let s = 0; s < samplesPerBucket && sampleIdx < totalSamples; s++, sampleIdx++) {
        while (chunkIdx < this.state.pcmChunks.length && chunkOffset >= this.state.pcmChunks[chunkIdx].length) {
          chunkOffset -= this.state.pcmChunks[chunkIdx].length;
          chunkIdx++;
        }
        if (chunkIdx < this.state.pcmChunks.length) {
          const val = Math.abs(this.state.pcmChunks[chunkIdx][chunkOffset]);
          if (val > maxAbs) maxAbs = val;
          chunkOffset++;
        }
      }
      preview[p] = maxAbs;
    }

    this.state.waveformPreview = preview;
  }

  // ─── State Management ─────────────────────────────────────────────────

  getState(): AudioEngineState {
    return this.state;
  }

  subscribe(listener: AudioEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.state));
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────

  dispose(): void {
    this.stop();
    workerManager.dispose();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
