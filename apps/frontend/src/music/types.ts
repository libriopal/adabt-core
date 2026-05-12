export type MusicEngineStatus =
  | 'idle'
  | 'decoding'
  | 'analyzing'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'error';

export interface MusicAnalysis {
  bpm: number;
  sampleRate: number;
  duration: number;
  sampleCount: number;
  peakAmplitude: number;
  rms: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
  waveform: number[];
  spectrum: number[];
}

export interface AudioAnalysisRequest {
  type: 'ANALYZE_AUDIO';
  payload: {
    requestId: number;
    samples: Float32Array;
    sampleRate: number;
    duration: number;
  };
}

export interface AudioAnalysisProgress {
  type: 'ANALYSIS_PROGRESS';
  payload: {
    requestId: number;
    progress: number;
    stage: string;
  };
}

export interface AudioAnalysisComplete {
  type: 'ANALYSIS_COMPLETE';
  payload: MusicAnalysis & { requestId: number };
}

export interface AudioAnalysisError {
  type: 'ANALYSIS_ERROR';
  payload: {
    requestId: number;
    message: string;
  };
}

export type AudioAnalysisResponse =
  | AudioAnalysisProgress
  | AudioAnalysisComplete
  | AudioAnalysisError;
