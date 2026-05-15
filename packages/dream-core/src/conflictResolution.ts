// ─────────────────────────────────────────────────────
// DREAM-CORE — Conflict Resolution Layer
// Orders and gates overlapping genre modifiers before
// they can affect payout, audio, visuals, or progression.
//
// GOVERNANCE RULE: Any modifier that changes payout must
// pass a 10,000-session Monte Carlo check before activation.
// Modifiers marked rtpGated=true are experience-only until
// validated.
// ─────────────────────────────────────────────────────

import type { DreamCoreState } from './types';

// ── Genre priority order (lower = higher authority) ────────────────────────
export const GENRE_PRIORITY: Record<string, number> = {
  HORROR:     1,
  ROGUELIKE:  2,
  CASINO:     3,
  MATCH3:     4,
  RHYTHM:     5,
  FPS:        6,
  METROIDVANIA: 7,
  BATTLE_ROYALE: 8,
  FIGHTING:   9,
  RPG:        10,
  PLATFORMER: 11,
  STEALTH:    12,
  RACING:     13,
  STRATEGY:   14,
  SIMULATION: 15,
  SPORTS:     16,
  ADVENTURE:  17,
  SANDBOX:    18,
  MOBA:       19,
  ABSTRACT:   20,
};

export interface GenreModifier {
  genre: string;
  priority: number;
  scoreMultiplier?: number;       // applied post Sacred Core score
  rtpGated: boolean;              // true = not yet Monte Carlo validated; ignored for payout
  experienceEffect?: string;      // description of cosmetic/audio effect
  activationCondition: (state: DreamCoreState) => boolean;
}

// ── Registered modifiers ───────────────────────────────────────────────────
// Only HORROR (heartbeat vignette) and ROGUELIKE (facet) are active for beta.
// All other scoreMultiplier entries are rtpGated=true until MC validation.
export const GENRE_MODIFIERS: GenreModifier[] = [
  {
    genre: 'HORROR',
    priority: 1,
    rtpGated: false,
    experienceEffect: 'Heartbeat LFO + vignette + stem muting. No payout change.',
    activationCondition: (s) => s.heartbeat.active,
  },
  {
    genre: 'ROGUELIKE',
    priority: 2,
    scoreMultiplier: undefined, // facet scoreMultiplier is rtpGated until MC
    rtpGated: true,
    experienceEffect: 'Facet passive modifies score presentation; MC required for real payout.',
    activationCondition: (s) => s.facet.equipped !== null,
  },
  {
    genre: 'CASINO',
    priority: 3,
    scoreMultiplier: undefined,
    rtpGated: true,
    experienceEffect: 'Volatility surge visual + audio amplifier. MC required for payout.',
    activationCondition: (s) => s.volatility.surgeActive,
  },
  {
    genre: 'MATCH3',
    priority: 4,
    rtpGated: false,
    experienceEffect: 'Chain reaction visual burst. No payout change in beta.',
    activationCondition: () => false, // wired in Phase 2
  },
  {
    genre: 'RHYTHM',
    priority: 5,
    scoreMultiplier: undefined,
    rtpGated: true,
    experienceEffect: 'Flow multiplier from beat accuracy. MC required for payout.',
    activationCondition: (s) => s.rhythm.comboStreak >= 3,
  },
  {
    genre: 'SPORTS',
    priority: 16,
    scoreMultiplier: undefined,
    rtpGated: true,
    experienceEffect: 'Trick meter juice multiplier. MC required for payout.',
    activationCondition: (s) => s.trickMeter.level === 'FRENZY',
  },
];

// ── Resolve active modifiers in priority order ─────────────────────────────

export interface ResolvedModifiers {
  activeEffects: GenreModifier[];
  // Effective score multiplier — only non-rtpGated multipliers contribute
  payoutMultiplier: number;
  // Combined experience description for audio/visual layers
  experienceSummary: string[];
}

export function resolveModifiers(state: DreamCoreState): ResolvedModifiers {
  const active = GENRE_MODIFIERS
    .filter(m => m.activationCondition(state))
    .sort((a, b) => a.priority - b.priority);

  let payoutMultiplier = 1.0;
  const experienceSummary: string[] = [];

  for (const mod of active) {
    if (!mod.rtpGated && mod.scoreMultiplier != null) {
      payoutMultiplier *= mod.scoreMultiplier;
    }
    if (mod.experienceEffect) {
      experienceSummary.push(`[${mod.genre}] ${mod.experienceEffect}`);
    }
  }

  // Cap multiplier to prevent runaway loops (hard governance limit)
  const cappedMultiplier = Math.min(payoutMultiplier, 4.0);

  return { activeEffects: active, payoutMultiplier: cappedMultiplier, experienceSummary };
}
