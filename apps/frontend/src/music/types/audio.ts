// ─── Core Audio Types ───────────────────────────────────────────────────────

/** Symbolic event extracted from audio analysis */
export interface SymbolicEvent {
  type: 'note' | 'chord' | 'beat' | 'transient' | 'section';
  onset: number;       // seconds
  duration: number;    // seconds
  pitch?: number;      // MIDI note number (notes only)
  velocity?: number;   // 0-1 normalized energy
  label?: string;      // e.g. "Am7", "verse", "kick"
  confidence: number;  // 0-1
}

/** Per-frame spectral analysis data */
export interface AnalysisFrame {
  time: number;
  spectrum: Float32Array;   // magnitude spectrum
  chroma: Float32Array;     // 12-bin chromagram
  rms: number;              // root mean square energy
  spectralCentroid: number;
  spectralFlux: number;
}

/** Complete track analysis result */
export interface TrackAnalysis {
  sampleRate: number;
  duration: number;
  bpm: number;
  key: string;              // e.g. "C minor"
  events: SymbolicEvent[];
  frames: AnalysisFrame[];  // downsampled to ~30fps
  beatGrid: number[];       // beat onset times in seconds
}

/** Audio file metadata */
export interface AudioFileInfo {
  name: string;
  size: number;
  type: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
}

/** Playback state */
export interface PlaybackState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  currentTime: number;
  duration: number;
  volume: number;
}

/** VFX snapshot — read by renderer at RAF rate */
export interface VFXSnapshot {
  time: number;
  spectrum: Float32Array;
  waveform: Float32Array;
  rms: number;
  peak: number;
  beatPhase: number;    // 0-1, cycles per beat
}
