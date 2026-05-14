// ─── Worker Message Protocol ────────────────────────────────────────────────
// Typed, discriminated union message bus for worker communication.
// Each message carries a monotonic sequence ID for ordering and cancellation.

// ─── Decode Worker Messages ─────────────────────────────────────────────────

export interface DecodeRequest {
  type: 'decode:start';
  seqId: number;
  fileData: ArrayBuffer;  // transferred, not copied
  fileName: string;
}

export interface DecodeProgress {
  type: 'decode:progress';
  seqId: number;
  percent: number;
  decodedSamples: number;
}

export interface DecodeChunk {
  type: 'decode:chunk';
  seqId: number;
  pcmData: Float32Array;  // transferred
  sampleRate: number;
  channels: number;
  chunkIndex: number;
}

export interface DecodeComplete {
  type: 'decode:complete';
  seqId: number;
  totalSamples: number;
  sampleRate: number;
  channels: number;
  duration: number;
}

export interface DecodeError {
  type: 'decode:error';
  seqId: number;
  error: string;
}

export interface CancelRequest {
  type: 'cancel';
  seqId: number;
}

export type DecodeWorkerInbound = DecodeRequest | CancelRequest;
export type DecodeWorkerOutbound = DecodeProgress | DecodeChunk | DecodeComplete | DecodeError;

// ─── Analysis Worker Messages ───────────────────────────────────────────────

export interface AnalyzeRequest {
  type: 'analyze:start';
  seqId: number;
  pcmData: Float32Array;  // transferred
  sampleRate: number;
  channels: number;
}

export interface AnalyzeProgress {
  type: 'analyze:progress';
  seqId: number;
  stage: 'fft' | 'bpm' | 'chroma' | 'transients' | 'symbolic';
  percent: number;
}

export interface AnalyzeComplete {
  type: 'analyze:complete';
  seqId: number;
  bpm: number;
  key: string;
  beatGrid: number[];
  frames: Array<{
    time: number;
    rms: number;
    spectralCentroid: number;
    spectralFlux: number;
  }>;
}

export interface AnalyzeError {
  type: 'analyze:error';
  seqId: number;
  error: string;
}

export type AnalysisWorkerInbound = AnalyzeRequest | CancelRequest;
export type AnalysisWorkerOutbound = AnalyzeProgress | AnalyzeComplete | AnalyzeError;

// ─── Telemetry ──────────────────────────────────────────────────────────────

export interface TelemetryEvent {
  type: 'telemetry';
  worker: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// ─── Union Types ────────────────────────────────────────────────────────────

export type WorkerInbound = DecodeWorkerInbound | AnalysisWorkerInbound;
export type WorkerOutbound = DecodeWorkerOutbound | AnalysisWorkerOutbound | TelemetryEvent;
