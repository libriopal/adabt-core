// ─── DSP Module ─────────────────────────────────────────────────────────────
// Barrel export for all DSP primitives.

export { runFFT, computeSTFT } from './fft';
export { estimateBPM, estimateBPMAutocorrelation } from './bpm';
export { estimateKey, computeChromagram } from './key';
