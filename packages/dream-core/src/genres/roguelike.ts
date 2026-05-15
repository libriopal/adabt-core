// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #3: ROGUELIKE (Facet Mutations)
// PRIORITY: 2nd (Genre Hierarchy Position 2)
// The strategic skeleton — every session is a "Run."
// ─────────────────────────────────────────────────────

import type { FacetDef, FacetId, FacetModifier, FacetState } from '../types';

// ── Facet Definitions ─────────────────────────────────────────────────────────

export const FACET_REGISTRY: Record<FacetId, FacetDef> = {
  // Tier 0 (base) Facets
  MISER: {
    id: 'MISER',
    name: 'The Miser',
    description: 'Banking under 300 grants +10% bonus. Rewards small, safe plays.',
    mutatesTo: 'HOARDER',
    mutationThreshold: 3,
    modifier: {
      bankThresholdBonus: 300,
      scoreMultiplier: 1.1,
    },
  },
  GLUTTON: {
    id: 'GLUTTON',
    name: 'The Glutton',
    description: 'Consecutive roll bonus caps at 1.5x. Rewards greedy play.',
    mutatesTo: 'ABYSSAL',
    mutationThreshold: 3,
    modifier: {
      scoreMultiplier: 1.0,
      riskAmplifier: 1.5,
    },
  },
  ALCHEMIST: {
    id: 'ALCHEMIST',
    name: 'The Alchemist',
    description: 'Transmute one die face per turn. Convert a 3 to a 1, etc.',
    mutatesTo: 'PHILOSOPHER',
    mutationThreshold: 3,
    modifier: {
      scoreMultiplier: 1.0,
    },
  },
  GAMBLER: {
    id: 'GAMBLER',
    name: 'The Gambler',
    description: 'Farkle recovery: 15% of lost unbanked returns as ghost points.',
    mutatesTo: 'CARDSHARP',
    mutationThreshold: 3,
    modifier: {
      farkleRecoveryPct: 0.15,
    },
  },
  SENTINEL: {
    id: 'SENTINEL',
    name: 'The Sentinel',
    description: 'LFO rate reduced by 20%. Calmer audio = calmer decisions.',
    mutatesTo: 'BULWARK',
    mutationThreshold: 3,
    modifier: {
      lfoRateMultiplier: 0.8,
    },
  },

  // Tier 1 (mutated) Facets
  HOARDER: {
    id: 'HOARDER',
    name: 'The Hoarder',
    description: 'Banking under 300 grants +25% bonus AND heals 1 Farkle count.',
    mutatesTo: null,
    mutationThreshold: Infinity,
    modifier: {
      bankThresholdBonus: 300,
      scoreMultiplier: 1.25,
      farkleRecoveryPct: 0.05,
    },
  },
  ABYSSAL: {
    id: 'ABYSSAL',
    name: 'The Abyssal',
    description: 'Consecutive roll bonus caps at 3x. But Farkle = instant round loss.',
    mutatesTo: null,
    mutationThreshold: Infinity,
    modifier: {
      scoreMultiplier: 1.0,
      riskAmplifier: 3.0,
      extraRollOnFarkle: false,
    },
  },
  PHILOSOPHER: {
    id: 'PHILOSOPHER',
    name: 'The Philosopher',
    description: 'Transmute TWO dice per turn. But only on prime-sum rolls.',
    mutatesTo: null,
    mutationThreshold: Infinity,
    modifier: {
      scoreMultiplier: 1.0,
    },
  },
  CARDSHARP: {
    id: 'CARDSHARP',
    name: 'The Cardsharp',
    description: 'Farkle recovery: 30% returns. No free-turn loops.',
    mutatesTo: null,
    mutationThreshold: Infinity,
    modifier: {
      farkleRecoveryPct: 0.30,
      extraRollOnFarkle: false,
    },
  },
  BULWARK: {
    id: 'BULWARK',
    name: 'The Bulwark',
    description: 'LFO rate reduced by 40%. Scorched tiles take 2x longer to reach you.',
    mutatesTo: null,
    mutationThreshold: Infinity,
    modifier: {
      lfoRateMultiplier: 0.6,
    },
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function createFacetState(): FacetState {
  return {
    equipped: null,
    roundsEquipped: 0,
    mutationTier: 0,
    availableFacets: ['MISER', 'GLUTTON', 'ALCHEMIST', 'GAMBLER', 'SENTINEL'],
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Draft phase: player selects a Facet between rounds.
 */
export function equipFacet(state: FacetState, facetId: FacetId): FacetState {
  if (!state.availableFacets.includes(facetId) && facetId !== state.equipped) {
    return state; // Can't equip what you don't have
  }

  return {
    ...state,
    equipped: facetId,
    roundsEquipped: facetId === state.equipped ? state.roundsEquipped : 0,
    mutationTier: facetId === state.equipped ? state.mutationTier : 0,
  };
}

/**
 * Called at end of each round. Checks for mutation threshold.
 */
export function tickFacetRound(state: FacetState): {
  state: FacetState;
  mutated: boolean;
  newFacetId: FacetId | null;
} {
  if (!state.equipped) {
    return { state, mutated: false, newFacetId: null };
  }

  const def = FACET_REGISTRY[state.equipped];
  if (!def) return { state, mutated: false, newFacetId: null };

  const newRounds = state.roundsEquipped + 1;

  // Check mutation
  if (def.mutatesTo && newRounds >= def.mutationThreshold) {
    const mutatedState: FacetState = {
      ...state,
      equipped: def.mutatesTo,
      roundsEquipped: 0,
      mutationTier: state.mutationTier + 1,
      availableFacets: [
        ...state.availableFacets.filter(f => f !== state.equipped),
        def.mutatesTo,
      ],
    };
    return { state: mutatedState, mutated: true, newFacetId: def.mutatesTo };
  }

  return {
    state: { ...state, roundsEquipped: newRounds },
    mutated: false,
    newFacetId: null,
  };
}

/**
 * Get the active modifier for the currently equipped Facet.
 */
export function getActiveModifier(state: FacetState): FacetModifier | null {
  if (!state.equipped) return null;
  return FACET_REGISTRY[state.equipped]?.modifier ?? null;
}

/**
 * Apply Facet modifier to a score (post-score wrapper).
 * Sacred Core scoring is UNTOUCHED — this wraps the result.
 */
export function applyFacetToScore(
  baseScore: number,
  bankedBefore: number,
  modifier: FacetModifier | null,
  isFrenzy: boolean,
): number {
  if (!modifier) return baseScore;

  let score = baseScore;

  // Score multiplier
  if (modifier.scoreMultiplier && modifier.scoreMultiplier !== 1.0) {
    const mult = isFrenzy ? modifier.scoreMultiplier * 2 : modifier.scoreMultiplier;
    score = Math.round(score * mult);
  }

  // Bank threshold bonus (Miser/Hoarder: bonus for banking under threshold)
  if (modifier.bankThresholdBonus && bankedBefore < modifier.bankThresholdBonus) {
    const bonusMult = modifier.scoreMultiplier ?? 1.1;
    score = Math.round(score * bonusMult);
  }

  return score;
}

/**
 * Compute Farkle recovery amount based on Facet.
 * Returns points to add back to unbanked after a Farkle.
 */
export function computeFarkleRecovery(
  lostUnbanked: number,
  modifier: FacetModifier | null,
): number {
  if (!modifier?.farkleRecoveryPct) return 0;
  return Math.round(lostUnbanked * modifier.farkleRecoveryPct);
}

/**
 * Generate Facet draft options for between-round selection.
 * Offers 3 random choices from available pool.
 */
export function generateDraftOptions(
  state: FacetState,
  rngFn: () => number,
): FacetId[] {
  const pool = state.availableFacets.filter(f => f !== state.equipped);
  if (pool.length <= 3) return pool;

  // Fisher-Yates partial shuffle for 3 picks
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > shuffled.length - 4 && i > 0; i--) {
    const j = Math.floor(rngFn() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled.slice(-3);
}
