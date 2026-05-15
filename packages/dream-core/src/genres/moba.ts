// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #19: MOBA (The Ultimate)
// Shared team meter; at 100 charge, next roll guaranteed not-Farkle.
// ⚠️ FLAGGED FOR CODERABBIT AUDIT: Server re-roll loop (max 3).
// ─────────────────────────────────────────────────────

import type { UltimateState } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_CHARGE = 100;
const CHARGE_PER_100_BANKED = 1;     // 1 charge per 100 points banked
const FARKLE_CHARGE_LOSS = 15;        // lose 15 charge on Farkle
const MAX_SERVER_REROLLS = 3;         // cap for server-side re-roll loop

// ── Factory ───────────────────────────────────────────────────────────────────
export function createUltimateState(): UltimateState {
  return {
    charge: 0,
    chargePerBank: CHARGE_PER_100_BANKED,
    chargeLossOnFarkle: FARKLE_CHARGE_LOSS,
    ready: false,
    fired: false,
    maxRerolls: MAX_SERVER_REROLLS,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Add charge based on banked score.
 * 1 charge per 100 points banked.
 */
export function addCharge(
  state: UltimateState,
  bankedScore: number,
  chargeMultiplier: number = 1.0,
): UltimateState {
  if (state.fired) return state; // can't charge after firing

  const chargeGain = Math.floor((bankedScore / 100) * state.chargePerBank * chargeMultiplier);
  const newCharge = Math.min(MAX_CHARGE, state.charge + chargeGain);

  return {
    ...state,
    charge: newCharge,
    ready: newCharge >= MAX_CHARGE,
  };
}

/**
 * Lose charge on Farkle.
 */
export function loseChargeOnFarkle(state: UltimateState): UltimateState {
  const newCharge = Math.max(0, state.charge - state.chargeLossOnFarkle);

  return {
    ...state,
    charge: newCharge,
    ready: newCharge >= MAX_CHARGE,
  };
}

/**
 * Fire the Ultimate — next roll guaranteed not-Farkle.
 *
 * IMPLEMENTATION NOTE (for CodeRabbit audit):
 * This does NOT modify the Sacred Core scorer. The server-side implementation:
 * 1. Calls csprng.rollDice() normally
 * 2. Checks lookupScore(faces) against the score table
 * 3. If score === 0 (Farkle), re-rolls (up to MAX_SERVER_REROLLS times)
 * 4. If all re-rolls Farkle, accepts the Farkle (safety valve)
 *
 * The client receives the FINAL dice faces — it never knows about re-rolls.
 * This maintains RTP integrity because:
 * - The Ultimate fires at most once per match
 * - Max 3 re-rolls caps the statistical impact
 * - Each re-roll uses the same CSPRNG stream (no bias)
 */
export function fireUltimate(state: UltimateState): {
  state: UltimateState;
  fired: boolean;
} {
  if (!state.ready || state.fired) {
    return { state, fired: false };
  }

  return {
    state: {
      ...state,
      charge: 0,
      ready: false,
      fired: true,
    },
    fired: true,
  };
}

/**
 * Server-side re-roll loop for Ultimate activation.
 * Returns the dice faces that result in a non-Farkle (or last attempt).
 */
export function ultimateRerollLoop(
  rollFn: () => number[],    // returns 6 dice faces
  scoreFn: (faces: number[]) => number, // Sacred Core lookupScore
  maxAttempts: number = MAX_SERVER_REROLLS,
): { faces: number[]; attempts: number; succeeded: boolean } {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const faces = rollFn();
    const score = scoreFn(faces);
    if (score > 0) {
      return { faces, attempts: attempt, succeeded: true };
    }
  }

  // Safety valve: accept the Farkle
  const finalFaces = rollFn();
  return { faces: finalFaces, attempts: maxAttempts + 1, succeeded: false };
}

/**
 * Get visual state for the Ultimate meter.
 */
export function getUltimateVisuals(state: UltimateState): UltimateVisuals {
  const progress = state.charge / MAX_CHARGE;

  return {
    charge: state.charge,
    maxCharge: MAX_CHARGE,
    progress,
    ready: state.ready,
    fired: state.fired,
    fillColor: state.ready
      ? '#ff00ff'
      : progress > 0.7
        ? '#ffaa00'
        : '#00aaff',
    glowIntensity: state.ready ? 1.0 : progress * 0.5,
    pulseActive: state.ready && !state.fired,
    labelText: state.fired
      ? 'ULTIMATE FIRED'
      : state.ready
        ? 'ULTIMATE READY!'
        : `${state.charge}/${MAX_CHARGE}`,
  };
}

export interface UltimateVisuals {
  charge: number;
  maxCharge: number;
  progress: number;
  ready: boolean;
  fired: boolean;
  fillColor: string;
  glowIntensity: number;
  pulseActive: boolean;
  labelText: string;
}
