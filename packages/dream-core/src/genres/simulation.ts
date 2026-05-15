// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #15: SIMULATION (Acoustic Decorations)
// Earned audio effects that change the sonic environment.
// ─────────────────────────────────────────────────────

import type { AcousticDecoration, AcousticDecorationId, AcousticState } from '../types';

// ── Decoration Registry ───────────────────────────────────────────────────────

export const ACOUSTIC_DECORATIONS: Record<AcousticDecorationId, AcousticDecoration> = {
  CATHEDRAL_REVERB: {
    id: 'CATHEDRAL_REVERB',
    name: 'Cathedral Reverb',
    description: 'Vast stone hall reverb. Everything echoes with sacred weight.',
    audioParams: {
      reverbDecay: 4.5,
      wetMix: 0.45,
    },
    unlockedAt: 'Unseal 3 Metroidvania tiles in a single match',
  },
  VINYL_CRACKLE: {
    id: 'VINYL_CRACKLE',
    name: 'Vinyl Crackle',
    description: 'Warm analog noise. Lo-fi warmth over every stem.',
    audioParams: {
      filterFreq: 4000,
      wetMix: 0.3,
    },
    unlockedAt: 'Bank 10 times without a Farkle',
  },
  BIT_CRUSHER: {
    id: 'BIT_CRUSHER',
    name: 'Bit Crusher',
    description: 'Retro 8-bit destruction. Every sound is crunchy.',
    audioParams: {
      bitDepth: 4,
      wetMix: 0.5,
    },
    unlockedAt: 'Achieve a 6-chain with all dice showing the same face',
  },
  HALL_OF_MIRRORS: {
    id: 'HALL_OF_MIRRORS',
    name: 'Hall of Mirrors',
    description: 'Cascading multi-tap delay. Sounds fold on themselves.',
    audioParams: {
      delayTaps: 5,
      delayTimeMs: 180,
      wetMix: 0.35,
    },
    unlockedAt: 'Trigger a 3-depth Phantasmagoric Chain',
  },
  UNDERWATER: {
    id: 'UNDERWATER',
    name: 'Underwater',
    description: 'Muffled aquatic filter. Sound travels through dark water.',
    audioParams: {
      filterFreq: 800,
      reverbDecay: 2.0,
      wetMix: 0.6,
    },
    unlockedAt: 'Survive 3 Heartbeat Protocol activations',
  },
  VOID_ECHO: {
    id: 'VOID_ECHO',
    name: 'Void Echo',
    description: 'Infinite space. No walls. Sound expands forever.',
    audioParams: {
      reverbDecay: 12.0,
      delayTaps: 3,
      delayTimeMs: 500,
      wetMix: 0.7,
    },
    unlockedAt: 'Win a match with all 6 territories claimed',
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────
export function createAcousticState(): AcousticState {
  return {
    equippedDecoration: null,
    unlockedDecorations: [],
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Unlock a new acoustic decoration.
 */
export function unlockDecoration(
  state: AcousticState,
  decorationId: AcousticDecorationId,
): AcousticState {
  if (state.unlockedDecorations.includes(decorationId)) return state;

  return {
    ...state,
    unlockedDecorations: [...state.unlockedDecorations, decorationId],
  };
}

/**
 * Equip an acoustic decoration (only unlocked ones).
 */
export function equipDecoration(
  state: AcousticState,
  decorationId: AcousticDecorationId | null,
): AcousticState {
  if (decorationId !== null && !state.unlockedDecorations.includes(decorationId)) {
    return state;
  }

  return {
    ...state,
    equippedDecoration: decorationId,
  };
}

/**
 * Get Web Audio API parameters for the equipped decoration.
 */
export function getDecorationAudioParams(state: AcousticState): DecorationAudioConfig | null {
  if (!state.equippedDecoration) return null;

  const decoration = ACOUSTIC_DECORATIONS[state.equippedDecoration];
  if (!decoration) return null;

  return {
    decorationId: decoration.id,
    reverb: decoration.audioParams.reverbDecay
      ? {
          decay: decoration.audioParams.reverbDecay,
          wetMix: decoration.audioParams.wetMix ?? 0.3,
        }
      : null,
    filter: decoration.audioParams.filterFreq
      ? {
          frequency: decoration.audioParams.filterFreq,
          type: 'lowpass' as BiquadFilterType,
        }
      : null,
    bitCrush: decoration.audioParams.bitDepth
      ? { depth: decoration.audioParams.bitDepth }
      : null,
    delay: decoration.audioParams.delayTaps
      ? {
          taps: decoration.audioParams.delayTaps,
          timeMs: decoration.audioParams.delayTimeMs ?? 200,
          feedback: 0.4,
        }
      : null,
  };
}

/**
 * Check if a milestone was reached for any locked decoration.
 */
export function checkDecorationMilestones(
  state: AcousticState,
  context: MilestoneContext,
): AcousticDecorationId[] {
  const newUnlocks: AcousticDecorationId[] = [];

  if (!state.unlockedDecorations.includes('CATHEDRAL_REVERB') && context.tilesUnsealed >= 3) {
    newUnlocks.push('CATHEDRAL_REVERB');
  }
  if (!state.unlockedDecorations.includes('VINYL_CRACKLE') && context.banksWithoutFarkle >= 10) {
    newUnlocks.push('VINYL_CRACKLE');
  }
  if (!state.unlockedDecorations.includes('BIT_CRUSHER') && context.sixChainSameFace) {
    newUnlocks.push('BIT_CRUSHER');
  }
  if (!state.unlockedDecorations.includes('HALL_OF_MIRRORS') && context.maxChainDepth >= 3) {
    newUnlocks.push('HALL_OF_MIRRORS');
  }
  if (!state.unlockedDecorations.includes('UNDERWATER') && context.heartbeatSurvivals >= 3) {
    newUnlocks.push('UNDERWATER');
  }
  if (!state.unlockedDecorations.includes('VOID_ECHO') && context.territoriesOwned >= 6) {
    newUnlocks.push('VOID_ECHO');
  }

  return newUnlocks;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DecorationAudioConfig {
  decorationId: AcousticDecorationId;
  reverb: { decay: number; wetMix: number } | null;
  filter: { frequency: number; type: BiquadFilterType } | null;
  bitCrush: { depth: number } | null;
  delay: { taps: number; timeMs: number; feedback: number } | null;
}

export interface MilestoneContext {
  tilesUnsealed: number;
  banksWithoutFarkle: number;
  sixChainSameFace: boolean;
  maxChainDepth: number;
  heartbeatSurvivals: number;
  territoriesOwned: number;
}
