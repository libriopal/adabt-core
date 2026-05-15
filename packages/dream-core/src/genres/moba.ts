// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #19: MOBA (The Ultimate)
// Shared team meter; at 100 charge, the next roll receives a cinematic
// "ultimate" wrapper only. It must never force dice, reroll CSPRNG output,
// or guarantee a non-Farkle outcome.
// [CODERABBIT AUDIT]: The former reroll loop is intentionally disabled.
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
 * Fire the Ultimate — arms the next roll's cinematic/audio wrapper.
 *
 * This does not modify the Sacred Core scorer and does not change the dice
 * stream. The actual roll must still come from the authoritative CSPRNG path.
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

export interface UltimateRerollAuditResult {
  faces: number[];
  attempts: number;
  succeeded: boolean;
  blocked: true;
  score: number;
  reason: 'RTP_WRAPPER_ONLY_NO_REROLL';
}

/**
 * Audit-locked compatibility shim for the rejected Ultimate reroll mechanic.
 *
 * The old design repeatedly called rollFn until a non-Farkle appeared. That
 * changes outcome distribution and violates RTP/CSPRNG integrity. Keep this
 * export so integration code cannot accidentally reintroduce the loop: it
 * consumes exactly one authoritative roll, reports the score, and marks the
 * reroll path blocked.
 */
export function ultimateRerollLoop(
  rollFn: () => number[],    // returns 6 dice faces
  scoreFn: (faces: number[]) => number, // Sacred Core lookupScore
  maxAttempts: number = MAX_SERVER_REROLLS,
): UltimateRerollAuditResult {
  void maxAttempts;
  const faces = rollFn();
  const score = scoreFn(faces);
  return {
    faces,
    attempts: 1,
    succeeded: false,
    blocked: true,
    score,
    reason: 'RTP_WRAPPER_ONLY_NO_REROLL',
  };
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
