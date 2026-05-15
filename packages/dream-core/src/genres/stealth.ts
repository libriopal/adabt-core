// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #11: STEALTH (Hidden Pocket)
// Pocket 1 scoring die for future deployment.
// ─────────────────────────────────────────────────────

import type { HiddenPocketState } from '../types';
import type { DieFace } from '../../farkle-shared/src/types';

// ── Factory ───────────────────────────────────────────────────────────────────
export function createHiddenPocketState(maxPockets: number = 1): HiddenPocketState {
  return {
    pocketedDie: null,
    pocketUsed: false,
    maxPockets,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Pocket a scoring die. Can only pocket once per match (unless Rogue class).
 * This die is removed from the current roll and stored for future use.
 * IMPORTANT: The pocketed die is NOT counted in the current chain score.
 * Sacred Core scoring sees 5 dice instead of 6.
 */
export function pocketDie(
  state: HiddenPocketState,
  face: DieFace,
): { state: HiddenPocketState; success: boolean } {
  if (state.pocketedDie !== null) {
    return { state, success: false }; // already full
  }

  if (state.pocketUsed && state.maxPockets <= 1) {
    return { state, success: false }; // already used this match
  }

  return {
    state: {
      ...state,
      pocketedDie: face,
    },
    success: true,
  };
}

/**
 * Deploy the pocketed die into the current roll.
 * Adds the stored face value to the current chain.
 * This is a presentation-layer action — it feeds an extra die face
 * into the Sacred Core scorer as if it was rolled.
 */
export function deployPocketedDie(
  state: HiddenPocketState,
): { state: HiddenPocketState; deployedFace: DieFace | null } {
  if (state.pocketedDie === null) {
    return { state, deployedFace: null };
  }

  const face = state.pocketedDie;
  return {
    state: {
      ...state,
      pocketedDie: null,
      pocketUsed: true,
    },
    deployedFace: face,
  };
}

/**
 * Check if pocketing is available.
 */
export function canPocket(state: HiddenPocketState): boolean {
  return state.pocketedDie === null && (!state.pocketUsed || state.maxPockets > 1);
}

/**
 * Get visual state for the pocket UI element.
 */
export function getPocketVisuals(state: HiddenPocketState): PocketVisuals {
  return {
    hasDie: state.pocketedDie !== null,
    dieValue: state.pocketedDie,
    canPocket: canPocket(state),
    canDeploy: state.pocketedDie !== null,
    glowing: state.pocketedDie !== null,
    tooltipText: state.pocketedDie !== null
      ? `Hidden: ${state.pocketedDie} — Click to deploy`
      : state.pocketUsed
        ? 'Pocket used'
        : 'Tap a scoring die to pocket it',
  };
}

export interface PocketVisuals {
  hasDie: boolean;
  dieValue: DieFace | null;
  canPocket: boolean;
  canDeploy: boolean;
  glowing: boolean;
  tooltipText: string;
}
