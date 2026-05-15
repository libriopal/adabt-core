// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #18: SANDBOX (Build-a-Die)
// Custom 7th die with player-assigned face values (1–6 only).
// ─────────────────────────────────────────────────────

import type { BuildADieState, CustomDie, AcousticDecorationId } from '../types';
import type { DieFace } from '../../farkle-shared/src/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const SHARDS_PER_DIE = 6;
const VALID_FACES: DieFace[] = [1, 2, 3, 4, 5, 6];

// ── Factory ───────────────────────────────────────────────────────────────────
export function createBuildADieState(startingShards: number = 0): BuildADieState {
  return {
    shards: startingShards,
    customDie: null,
    deployed: false,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Award a shard to the player (from unsealing a Metroidvania tile,
 * achieving milestones, etc.)
 */
export function awardShard(state: BuildADieState): BuildADieState {
  return {
    ...state,
    shards: state.shards + 1,
  };
}

/**
 * Check if the player has enough shards to build a custom die.
 */
export function canBuildDie(state: BuildADieState): boolean {
  return state.shards >= SHARDS_PER_DIE && state.customDie === null;
}

/**
 * Build a custom die with player-assigned face values.
 * All face values must be valid (1–6). This doesn't modify the Sacred Core —
 * the custom die is treated as a 7th die that's scored through the
 * standard lookupScore pathway.
 */
export function buildCustomDie(
  state: BuildADieState,
  faces: [DieFace, DieFace, DieFace, DieFace, DieFace, DieFace],
  skin: CustomDie['skin'] = 'OBSIDIAN',
  soundProfile: AcousticDecorationId = 'VOID_ECHO',
  name: string = 'Custom Die',
): { state: BuildADieState; success: boolean; error?: string } {
  if (state.shards < SHARDS_PER_DIE) {
    return { state, success: false, error: 'Not enough shards' };
  }

  if (state.customDie !== null) {
    return { state, success: false, error: 'Already have a custom die' };
  }

  // Validate all faces are 1–6
  for (const face of faces) {
    if (!VALID_FACES.includes(face)) {
      return { state, success: false, error: `Invalid face value: ${face}` };
    }
  }

  return {
    state: {
      shards: state.shards - SHARDS_PER_DIE,
      customDie: { faces, skin, soundProfile, name },
      deployed: false,
    },
    success: true,
  };
}

/**
 * Deploy the custom die into the game (adds the 7th die to the roll pool).
 */
export function deployDie(state: BuildADieState): {
  state: BuildADieState;
  deployed: boolean;
} {
  if (!state.customDie || state.deployed) {
    return { state, deployed: false };
  }

  return {
    state: { ...state, deployed: true },
    deployed: true,
  };
}

/**
 * Roll the custom die — returns a face based on the custom distribution.
 * Uses the provided RNG function for Sacred Core compliance.
 */
export function rollCustomDie(
  customDie: CustomDie,
  rngFn: () => number,
): DieFace {
  const index = Math.floor(rngFn() * 6);
  return customDie.faces[index]!;
}

/**
 * Destroy the custom die (e.g., on match end or as a strategic sacrifice).
 */
export function destroyDie(state: BuildADieState): BuildADieState {
  return {
    ...state,
    customDie: null,
    deployed: false,
  };
}

/**
 * Get the face distribution for display.
 */
export function getFaceDistribution(customDie: CustomDie): Record<DieFace, number> {
  const dist: Record<DieFace, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const face of customDie.faces) {
    dist[face]++;
  }
  return dist;
}

/**
 * Get visual state for the Build-a-Die UI.
 */
export function getBuildADieVisuals(state: BuildADieState): BuildADieVisuals {
  return {
    shards: state.shards,
    shardsRequired: SHARDS_PER_DIE,
    canBuild: canBuildDie(state),
    hasDie: state.customDie !== null,
    deployed: state.deployed,
    diePreview: state.customDie
      ? {
          faces: state.customDie.faces,
          skin: state.customDie.skin,
          name: state.customDie.name,
          distribution: getFaceDistribution(state.customDie),
        }
      : null,
    shardProgress: Math.min(1.0, state.shards / SHARDS_PER_DIE),
  };
}

export interface BuildADieVisuals {
  shards: number;
  shardsRequired: number;
  canBuild: boolean;
  hasDie: boolean;
  deployed: boolean;
  diePreview: {
    faces: DieFace[];
    skin: string;
    name: string;
    distribution: Record<DieFace, number>;
  } | null;
  shardProgress: number;
}
