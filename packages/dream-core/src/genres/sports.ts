// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #16: SPORTS (Trick Meter)
// 3/5/8-streak thresholds trigger escalating visual/audio states.
// ─────────────────────────────────────────────────────

import type { TrickMeterState, TrickLevel } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const WARM_THRESHOLD = 3;     // 3 consecutive banks
const HOT_THRESHOLD = 5;      // 5 consecutive banks
const FRENZY_THRESHOLD = 8;   // 8 consecutive banks

const JUICE_MULTIPLIERS: Record<TrickLevel, number> = {
  COLD: 1.0,
  WARM: 1.25,
  HOT: 1.5,
  FRENZY: 2.0,
};

// ── Factory ───────────────────────────────────────────────────────────────────
export function createTrickMeterState(): TrickMeterState {
  return {
    streak: 0,
    level: 'COLD',
    juiceMultiplier: 1.0,
    facetDoubled: false,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Record a successful bank (no Farkle).
 */
export function recordBank(state: TrickMeterState): TrickMeterState {
  const streak = state.streak + 1;
  const level = computeLevel(streak);

  return {
    streak,
    level,
    juiceMultiplier: JUICE_MULTIPLIERS[level],
    facetDoubled: level === 'FRENZY',
  };
}

/**
 * Record a Farkle — resets the trick meter.
 */
export function recordFarkle(state: TrickMeterState): TrickMeterState {
  return createTrickMeterState();
}

function computeLevel(streak: number): TrickLevel {
  if (streak >= FRENZY_THRESHOLD) return 'FRENZY';
  if (streak >= HOT_THRESHOLD) return 'HOT';
  if (streak >= WARM_THRESHOLD) return 'WARM';
  return 'COLD';
}

/**
 * Get audio stem intensity based on trick meter level.
 */
export function getTrickAudioIntensity(state: TrickMeterState): TrickAudioParams {
  switch (state.level) {
    case 'COLD':
      return {
        percussionLayer: 0.3,
        bassLayer: 0.4,
        leadLayer: 0.0,
        filterCutoff: 2000,
        reverbMix: 0.3,
      };
    case 'WARM':
      return {
        percussionLayer: 0.5,
        bassLayer: 0.6,
        leadLayer: 0.2,
        filterCutoff: 4000,
        reverbMix: 0.25,
      };
    case 'HOT':
      return {
        percussionLayer: 0.8,
        bassLayer: 0.8,
        leadLayer: 0.5,
        filterCutoff: 8000,
        reverbMix: 0.15,
      };
    case 'FRENZY':
      return {
        percussionLayer: 1.0,
        bassLayer: 1.0,
        leadLayer: 1.0,
        filterCutoff: 20000,
        reverbMix: 0.05,
      };
  }
}

/**
 * Get visual parameters for the trick meter UI.
 */
export function getTrickMeterVisuals(state: TrickMeterState): TrickMeterVisuals {
  const progress = state.streak / FRENZY_THRESHOLD;

  return {
    level: state.level,
    streak: state.streak,
    progress: Math.min(1.0, progress),
    fillColor: getLevelColor(state.level),
    backgroundColor: getLevelBgColor(state.level),
    glowIntensity: state.level === 'FRENZY' ? 1.0 : state.level === 'HOT' ? 0.6 : 0.2,
    shakeIntensity: state.level === 'FRENZY' ? 0.3 : 0,
    labelText: `${state.level} ×${state.juiceMultiplier.toFixed(2)}`,
    particleEmitting: state.level === 'HOT' || state.level === 'FRENZY',
  };
}

function getLevelColor(level: TrickLevel): string {
  switch (level) {
    case 'COLD': return '#4488aa';
    case 'WARM': return '#ffaa33';
    case 'HOT': return '#ff4400';
    case 'FRENZY': return '#ff00ff';
  }
}

function getLevelBgColor(level: TrickLevel): string {
  switch (level) {
    case 'COLD': return '#112233';
    case 'WARM': return '#331a00';
    case 'HOT': return '#330800';
    case 'FRENZY': return '#330033';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrickAudioParams {
  percussionLayer: number;
  bassLayer: number;
  leadLayer: number;
  filterCutoff: number;
  reverbMix: number;
}

export interface TrickMeterVisuals {
  level: TrickLevel;
  streak: number;
  progress: number;
  fillColor: string;
  backgroundColor: string;
  glowIntensity: number;
  shakeIntensity: number;
  labelText: string;
  particleEmitting: boolean;
}
