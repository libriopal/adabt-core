// ─── Music Intelligence Engine ──────────────────────────────────────────────
// Barrel export for the unified music module.
// All music engine code lives here — no separate app needed.

// Hooks
export { useAudioEngine } from './hooks/useAudioEngine';

// DSP primitives
export { runFFT, computeSTFT, estimateBPM, estimateBPMAutocorrelation } from './dsp';

// Types
export type {
  AudioFileInfo,
  PlaybackState,
  VFXSnapshot,
  SymbolicEvent,
  AnalysisFrame,
  TrackAnalysis,
} from './types/audio';
