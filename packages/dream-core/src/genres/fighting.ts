// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #7: FIGHTING (Combo Breaker)
// 250ms reversal window during Farkle animation.
// Spend a Precision Strike token to reverse the Farkle.
// ─────────────────────────────────────────────────────

import type { ComboBreakerState, PrecisionStrikeState } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const REVERSAL_WINDOW_MS = 250;    // window after Farkle animation starts
const COOLDOWN_MS = 5000;          // cooldown between breakers

// ── Factory ───────────────────────────────────────────────────────────────────
export function createComboBreakerState(): ComboBreakerState {
  return {
    windowActive: false,
    windowExpiresAt: 0,
    tokenCost: 1,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Called when a Farkle occurs. Opens the reversal window.
 */
export function openReversalWindow(
  state: ComboBreakerState,
  now: number = Date.now(),
): ComboBreakerState {
  return {
    ...state,
    windowActive: true,
    windowExpiresAt: now + REVERSAL_WINDOW_MS,
  };
}

/**
 * Attempt to use the Combo Breaker.
 * Requires an active window and a Precision Strike token.
 */
export function attemptComboBreaker(
  breakerState: ComboBreakerState,
  precisionState: PrecisionStrikeState,
  now: number = Date.now(),
): {
  breakerState: ComboBreakerState;
  precisionState: PrecisionStrikeState;
  success: boolean;
  commands: ComboBreakerCommand[];
} {
  // Check window
  if (!breakerState.windowActive || now > breakerState.windowExpiresAt) {
    return {
      breakerState: { ...breakerState, windowActive: false },
      precisionState,
      success: false,
      commands: [{ type: 'WINDOW_EXPIRED_FLASH' }],
    };
  }

  // Check token
  if (precisionState.tokens < breakerState.tokenCost) {
    return {
      breakerState,
      precisionState,
      success: false,
      commands: [{ type: 'NO_TOKENS_SHAKE' }],
    };
  }

  // SUCCESS: Reverse the Farkle
  const commands: ComboBreakerCommand[] = [
    { type: 'REVERSAL_EXPLOSION', color: '#ff3333', durationMs: 400 },
    { type: 'SCREEN_FLASH', color: 'white', durationMs: 100 },
    { type: 'AUDIO_STING', note: 'REVERSAL' },
    { type: 'CAMERA_ZOOM', targetScale: 1.1, durationMs: 300 },
  ];

  return {
    breakerState: {
      ...breakerState,
      windowActive: false,
    },
    precisionState: {
      ...precisionState,
      tokens: precisionState.tokens - breakerState.tokenCost,
    },
    success: true,
    commands,
  };
}

/**
 * Tick the combo breaker window. Auto-closes when expired.
 */
export function tickComboBreaker(
  state: ComboBreakerState,
  now: number = Date.now(),
): ComboBreakerState {
  if (state.windowActive && now >= state.windowExpiresAt) {
    return { ...state, windowActive: false };
  }
  return state;
}

/**
 * Get the visual state for the reversal prompt UI.
 */
export function getReversalPromptVisuals(state: ComboBreakerState, now: number): ReversalVisuals | null {
  if (!state.windowActive) return null;

  const remaining = Math.max(0, state.windowExpiresAt - now);
  const progress = 1.0 - remaining / REVERSAL_WINDOW_MS;

  return {
    visible: true,
    timeRemainingMs: remaining,
    progressBar: progress,
    urgencyColor: progress > 0.7 ? '#ff0000' : progress > 0.4 ? '#ffaa00' : '#00ff00',
    pulseSpeed: 1.0 + progress * 4.0,
    text: 'BREAK IT!',
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComboBreakerCommand =
  | { type: 'REVERSAL_EXPLOSION'; color: string; durationMs: number }
  | { type: 'SCREEN_FLASH'; color: string; durationMs: number }
  | { type: 'AUDIO_STING'; note: string }
  | { type: 'CAMERA_ZOOM'; targetScale: number; durationMs: number }
  | { type: 'WINDOW_EXPIRED_FLASH' }
  | { type: 'NO_TOKENS_SHAKE' };

export interface ReversalVisuals {
  visible: boolean;
  timeRemainingMs: number;
  progressBar: number;
  urgencyColor: string;
  pulseSpeed: number;
  text: string;
}
