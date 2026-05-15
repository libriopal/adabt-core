// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #1: FPS (Precision Strike)
// Aggressive recovery tokens earned by continuing past 500 unbanked.
// ─────────────────────────────────────────────────────

import type { PrecisionStrikeState } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const COURAGE_THRESHOLD = 500;       // unbanked threshold for token earn
const MAX_TOKENS = 5;                // maximum stored tokens
const TOKEN_EARN_COOLDOWN_MS = 5000; // prevent rapid farming

// ── Factory ───────────────────────────────────────────────────────────────────
export function createPrecisionStrikeState(): PrecisionStrikeState {
  return {
    tokens: 0,
    lastBankWasCourageous: false,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Evaluate when a player commits a chain while unbanked is above the courage threshold.
 * Awards a Precision Strike token.
 */
export function evaluateCourage(
  state: PrecisionStrikeState,
  unbanked: number,
  chainScore: number,
): PrecisionStrikeState {
  const courageous = unbanked >= COURAGE_THRESHOLD && chainScore > 0;

  if (courageous && state.tokens < MAX_TOKENS) {
    return {
      tokens: state.tokens + 1,
      lastBankWasCourageous: true,
    };
  }

  return {
    ...state,
    lastBankWasCourageous: courageous,
  };
}

/**
 * Spend a Precision Strike token for a Combo Breaker reversal.
 * Returns updated state and whether the spend was successful.
 */
export function spendToken(state: PrecisionStrikeState): {
  state: PrecisionStrikeState;
  spent: boolean;
} {
  if (state.tokens <= 0) {
    return { state, spent: false };
  }

  return {
    state: { ...state, tokens: state.tokens - 1 },
    spent: true,
  };
}

/**
 * Get the visual state for the token display.
 */
export function getTokenVisuals(state: PrecisionStrikeState): TokenVisual[] {
  const visuals: TokenVisual[] = [];
  for (let i = 0; i < MAX_TOKENS; i++) {
    visuals.push({
      index: i,
      filled: i < state.tokens,
      glowing: state.lastBankWasCourageous && i === state.tokens - 1,
      color: i < state.tokens ? '#ff3333' : '#331111',
    });
  }
  return visuals;
}

export interface TokenVisual {
  index: number;
  filled: boolean;
  glowing: boolean;
  color: string;
}
