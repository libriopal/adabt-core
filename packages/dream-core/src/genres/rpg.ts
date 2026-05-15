// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #8: RPG (Dice Classes)
// Paladin, Rogue, Bard, Artificer — unique experience modifiers.
// ─────────────────────────────────────────────────────

import type { DiceClass, DiceClassDef, DiceClassState } from '../types';

// ── Class Registry ────────────────────────────────────────────────────────────

export const DICE_CLASS_REGISTRY: Record<DiceClass, DiceClassDef> = {
  PALADIN: {
    id: 'PALADIN',
    name: 'The Paladin',
    passive: 'Shield: First Farkle each match is absorbed (no loss).',
    ability: 'Consecrate: Next 3 rolls get +10% score bonus.',
    audioStemLayer: 'choir_pad',
    flowMultiplierCap: 1.6,  // conservative cap
    hiddenPockets: 1,
    shieldCharges: 1,
  },
  ROGUE: {
    id: 'ROGUE',
    name: 'The Rogue',
    passive: 'Sleight: 2 Hidden Pockets instead of 1.',
    ability: 'Backstab: Double the next chain\'s score (once per match).',
    audioStemLayer: 'staccato_pluck',
    flowMultiplierCap: 2.0,
    hiddenPockets: 2,
    shieldCharges: 0,
  },
  BARD: {
    id: 'BARD',
    name: 'The Bard',
    passive: 'Harmony: Beat window expanded by 30ms.',
    ability: 'Crescendo: Frenzy duration extended by 10s.',
    audioStemLayer: 'arpeggio_lead',
    flowMultiplierCap: 2.0,
    hiddenPockets: 1,
    shieldCharges: 0,
  },
  ARTIFICER: {
    id: 'ARTIFICER',
    name: 'The Artificer',
    passive: 'Tinker: Start with 3 Build-a-Die shards.',
    ability: 'Overcharge: Double Ultimate charge gain for 15s.',
    audioStemLayer: 'synth_arp',
    flowMultiplierCap: 1.8,
    hiddenPockets: 1,
    shieldCharges: 0,
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function createDiceClassState(): DiceClassState {
  return {
    selectedClass: null,
    shieldUsed: false,
    classAbilityCharges: 1,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Select a Dice Class at match start. Immutable after selection.
 */
export function selectDiceClass(
  state: DiceClassState,
  diceClass: DiceClass,
): DiceClassState {
  if (state.selectedClass !== null) return state; // no re-selection

  const def = DICE_CLASS_REGISTRY[diceClass];
  return {
    selectedClass: diceClass,
    shieldUsed: false,
    classAbilityCharges: 1,
  };
}

/**
 * Attempt to absorb a Farkle with Paladin's shield.
 */
export function attemptShieldAbsorb(state: DiceClassState): {
  state: DiceClassState;
  absorbed: boolean;
} {
  if (state.selectedClass !== 'PALADIN') return { state, absorbed: false };
  if (state.shieldUsed) return { state, absorbed: false };

  return {
    state: { ...state, shieldUsed: true },
    absorbed: true,
  };
}

/**
 * Use the class ability (once per match).
 */
export function useClassAbility(state: DiceClassState): {
  state: DiceClassState;
  effect: ClassAbilityEffect | null;
} {
  if (!state.selectedClass || state.classAbilityCharges <= 0) {
    return { state, effect: null };
  }

  const def = DICE_CLASS_REGISTRY[state.selectedClass];
  const newState = { ...state, classAbilityCharges: state.classAbilityCharges - 1 };

  let effect: ClassAbilityEffect;
  switch (state.selectedClass) {
    case 'PALADIN':
      effect = { type: 'CONSECRATE', scoreBonusPct: 0.10, durationRolls: 3 };
      break;
    case 'ROGUE':
      effect = { type: 'BACKSTAB', nextChainDoubled: true };
      break;
    case 'BARD':
      effect = { type: 'CRESCENDO', frenzyExtensionMs: 10000 };
      break;
    case 'ARTIFICER':
      effect = { type: 'OVERCHARGE', ultimateChargeMultiplier: 2.0, durationMs: 15000 };
      break;
  }

  return { state: newState, effect };
}

/**
 * Get the beat window modifier for the selected class.
 */
export function getClassBeatWindowModifier(state: DiceClassState): number {
  if (state.selectedClass === 'BARD') return 30; // +30ms window
  return 0;
}

/**
 * Get the hidden pocket count for the selected class.
 */
export function getClassHiddenPockets(state: DiceClassState): number {
  if (!state.selectedClass) return 1;
  return DICE_CLASS_REGISTRY[state.selectedClass].hiddenPockets;
}

/**
 * Get class-specific audio stem layer to activate.
 */
export function getClassAudioStem(state: DiceClassState): string | null {
  if (!state.selectedClass) return null;
  return DICE_CLASS_REGISTRY[state.selectedClass].audioStemLayer;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClassAbilityEffect =
  | { type: 'CONSECRATE'; scoreBonusPct: number; durationRolls: number }
  | { type: 'BACKSTAB'; nextChainDoubled: boolean }
  | { type: 'CRESCENDO'; frenzyExtensionMs: number }
  | { type: 'OVERCHARGE'; ultimateChargeMultiplier: number; durationMs: number };
