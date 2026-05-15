// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #14: HORROR (Heartbeat LFO)
// PRIORITY: HIGHEST (Genre Hierarchy Position 1)
// The emotional baseline of the entire system.
// ─────────────────────────────────────────────────────

import type { HeartbeatState } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const HEARTBEAT_BPM = 140;
const SUB_BASS_FREQ = 40;         // Hz — chest-tightening frequency
const MAX_REVEAL_DELAY = 320;     // ms
const NORMAL_REVEAL_DELAY = 80;   // ms
const FLATLINE_DURATION = 600;    // ms
const VIGNETTE_RAMP_SPEED = 0.15; // per frame (0–1 in ~7 frames)

// ── Factory ───────────────────────────────────────────────────────────────────
export function createHeartbeatState(): HeartbeatState {
  return {
    active: false,
    nonScoringDice: 0,
    lfoFrequency: SUB_BASS_FREQ,
    lfoBpm: HEARTBEAT_BPM,
    bpm: HEARTBEAT_BPM,
    stemsMuted: false,
    vignetteIntensity: 0,
    revealDelayMs: NORMAL_REVEAL_DELAY,
    flatlineActive: false,
    flatlined: false,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Evaluate whether the Heartbeat Protocol should activate.
 * Triggers when player is ONE die away from a Farkle (5 of 6 non-scoring).
 */
export function evaluateHeartbeat(
  totalDice: number,
  scoringDice: number,
  state: HeartbeatState,
): HeartbeatState {
  const nonScoring = totalDice - scoringDice;
  const shouldActivate = totalDice >= 2 && nonScoring >= totalDice - 1;

  if (shouldActivate && !state.active) {
    // ENTER HEARTBEAT
    return {
      ...state,
      active: true,
      nonScoringDice: nonScoring,
      stemsMuted: true,
      vignetteIntensity: 0.3,  // immediate partial vignette
      revealDelayMs: MAX_REVEAL_DELAY,
      flatlineActive: false,
    };
  }

  if (!shouldActivate && state.active) {
    // EXIT HEARTBEAT (survived)
    return {
      ...state,
      active: false,
      nonScoringDice: 0,
      stemsMuted: false,
      vignetteIntensity: 0,
      revealDelayMs: NORMAL_REVEAL_DELAY,
      flatlineActive: false,
    };
  }

  return { ...state, nonScoringDice: nonScoring };
}

/**
 * Called when final die is revealed during Heartbeat.
 * Returns audio/visual commands for the resolution.
 */
export function resolveHeartbeat(
  survived: boolean,
  state: HeartbeatState,
): { state: HeartbeatState; commands: HeartbeatCommand[] } {
  const commands: HeartbeatCommand[] = [];

  if (survived) {
    // SURVIVAL: Explosion of relief
    commands.push(
      { type: 'RESTORE_STEMS', fadeInMs: 200 },
      { type: 'PLAY_HARMONIC_FIFTH', frequency: SUB_BASS_FREQ * 1.5 },
      { type: 'PARTICLE_BURST', color: 'gold', intensity: 1.0 },
      { type: 'VIGNETTE_RELEASE', durationMs: 400 },
      { type: 'SCREEN_SHAKE', intensity: 0.3, durationMs: 150 },
    );
    return {
      state: createHeartbeatState(),
      commands,
    };
  } else {
    // FARKLE DURING HEARTBEAT: Maximum dread payoff
    commands.push(
      { type: 'FLATLINE_TONE', frequency: SUB_BASS_FREQ * 1.059 }, // minor second
      { type: 'OSCILLOSCOPE_FLATLINE', durationMs: FLATLINE_DURATION },
      { type: 'SCREEN_SHAKE', intensity: 0.8, durationMs: FLATLINE_DURATION },
      { type: 'VIGNETTE_FLASH', color: 'red', durationMs: 300 },
    );
    return {
      state: { ...createHeartbeatState(), flatlineActive: true },
      commands,
    };
  }
}

/**
 * Per-frame vignette intensity update during active Heartbeat.
 */
export function tickHeartbeatVignette(state: HeartbeatState, deltaMs: number): HeartbeatState {
  if (!state.active) return state;

  const targetIntensity = 0.85; // near-black edges
  const step = VIGNETTE_RAMP_SPEED * (deltaMs / 16.67);
  const newIntensity = Math.min(targetIntensity, state.vignetteIntensity + step);

  return { ...state, vignetteIntensity: newIntensity };
}

// ── Audio Command Types ───────────────────────────────────────────────────────

export type HeartbeatCommand =
  | { type: 'RESTORE_STEMS'; fadeInMs: number }
  | { type: 'PLAY_HARMONIC_FIFTH'; frequency: number }
  | { type: 'PARTICLE_BURST'; color: string; intensity: number }
  | { type: 'VIGNETTE_RELEASE'; durationMs: number }
  | { type: 'VIGNETTE_FLASH'; color: string; durationMs: number }
  | { type: 'SCREEN_SHAKE'; intensity: number; durationMs: number }
  | { type: 'FLATLINE_TONE'; frequency: number }
  | { type: 'OSCILLOSCOPE_FLATLINE'; durationMs: number };

// ── Audio Engine Integration ──────────────────────────────────────────────────

/**
 * Generate Web Audio API parameters for the Heartbeat sub-bass pulse.
 */
export function getHeartbeatAudioParams(state: HeartbeatState): HeartbeatAudioParams | null {
  if (!state.active) return null;

  const beatIntervalMs = (60 / state.lfoBpm) * 1000;

  return {
    oscillatorFrequency: state.lfoFrequency,
    oscillatorType: 'sine' as OscillatorType,
    gainEnvelope: {
      attack: 0.01,
      sustain: beatIntervalMs * 0.3 / 1000,
      release: beatIntervalMs * 0.5 / 1000,
      peak: 0.6,
    },
    beatIntervalMs,
    muteAllStems: state.stemsMuted,
    filterCutoff: 120,   // Low-pass everything above 120Hz
    filterQ: 8,          // Resonant peak for chest vibration
  };
}

export interface HeartbeatAudioParams {
  oscillatorFrequency: number;
  oscillatorType: OscillatorType;
  gainEnvelope: {
    attack: number;
    sustain: number;
    release: number;
    peak: number;
  };
  beatIntervalMs: number;
  muteAllStems: boolean;
  filterCutoff: number;
  filterQ: number;
}
