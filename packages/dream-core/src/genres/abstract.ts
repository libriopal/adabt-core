// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #20: ABSTRACT (Rules Are Fluid)
// Rule Shards temporarily modify scoring perception.
// Post-score wrapper — Sacred Core UNTOUCHED.
// ─────────────────────────────────────────────────────

import type { RuleShardState, RuleShardEffect } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_SHARD_DURATION_MS = 30000; // 30 seconds

// ── Rule Shard Registry ───────────────────────────────────────────────────────

export const RULE_SHARD_EFFECTS: RuleShardEffect[] = [
  { type: 'EVENS_ARE_ODDS', bonusPerEven: 50 },
  { type: 'PAIRS_PAY', pairBonus: 200 },
  { type: 'INVERSE_FARKLE' },
];

// ── Factory ───────────────────────────────────────────────────────────────────
export function createRuleShardState(): RuleShardState {
  return {
    activeRule: null,
    expiresAt: 0,
    durationMs: DEFAULT_SHARD_DURATION_MS,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Activate a Rule Shard. Replaces any currently active rule.
 */
export function activateRuleShard(
  state: RuleShardState,
  effect: RuleShardEffect,
  now: number = Date.now(),
): RuleShardState {
  return {
    activeRule: effect,
    expiresAt: now + state.durationMs,
    durationMs: state.durationMs,
  };
}

/**
 * Tick the rule shard — deactivate when expired.
 */
export function tickRuleShard(
  state: RuleShardState,
  now: number = Date.now(),
): RuleShardState {
  if (state.activeRule && now >= state.expiresAt) {
    return {
      ...state,
      activeRule: null,
    };
  }
  return state;
}

/**
 * Apply the active Rule Shard to a scored result.
 * This is a POST-SCORE wrapper — the Sacred Core lookupScore runs first,
 * then this function adds bonus points based on the active rule.
 *
 * IMPORTANT: This never reduces the Sacred Core score. It only adds bonus.
 * lookupScore(faces) is called normally. This wraps the result.
 */
export function applyRuleShard(
  baseScore: number,
  faces: number[],
  state: RuleShardState,
): { modifiedScore: number; bonusApplied: number; ruleLabel: string | null } {
  if (!state.activeRule) {
    return { modifiedScore: baseScore, bonusApplied: 0, ruleLabel: null };
  }

  const rule = state.activeRule;
  let bonus = 0;
  let ruleLabel: string | null = null;

  switch (rule.type) {
    case 'EVENS_ARE_ODDS': {
      // Even dice (2, 4, 6) earn bonus points each
      const evenCount = faces.filter(f => f % 2 === 0).length;
      bonus = evenCount * rule.bonusPerEven;
      ruleLabel = `EVENS ARE ODDS: +${bonus}`;
      break;
    }
    case 'PAIRS_PAY': {
      // Any pair of matching dice earns a bonus
      const counts = new Map<number, number>();
      for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
      const pairCount = [...counts.values()].filter(c => c >= 2).length;
      bonus = pairCount * rule.pairBonus;
      ruleLabel = pairCount > 0 ? `PAIRS PAY: +${bonus}` : null;
      break;
    }
    case 'INVERSE_FARKLE': {
      // If the base score is 0 (Farkle), grant 500 points instead
      // If the base score is > 0, it stays (no penalty)
      if (baseScore === 0) {
        bonus = 500;
        ruleLabel = 'INVERSE FARKLE: +500';
      }
      break;
    }
  }

  return {
    modifiedScore: baseScore + bonus,
    bonusApplied: bonus,
    ruleLabel,
  };
}

/**
 * Generate a random Rule Shard effect (for unsealing tiles, etc.)
 */
export function generateRandomShard(rngFn: () => number): RuleShardEffect {
  const index = Math.floor(rngFn() * RULE_SHARD_EFFECTS.length);
  return RULE_SHARD_EFFECTS[index]!;
}

/**
 * Get visual state for the active Rule Shard.
 */
export function getRuleShardVisuals(state: RuleShardState, now: number): RuleShardVisuals | null {
  if (!state.activeRule) return null;

  const remaining = Math.max(0, state.expiresAt - now);
  const progress = 1.0 - remaining / state.durationMs;

  return {
    ruleName: getRuleName(state.activeRule),
    ruleDescription: getRuleDescription(state.activeRule),
    timeRemainingMs: remaining,
    progress,
    color: getRuleColor(state.activeRule),
    icon: getRuleIcon(state.activeRule),
    pulsing: remaining < 5000, // pulse when about to expire
  };
}

function getRuleName(effect: RuleShardEffect): string {
  switch (effect.type) {
    case 'EVENS_ARE_ODDS': return 'Evens Are Odds';
    case 'PAIRS_PAY': return 'Pairs Pay';
    case 'INVERSE_FARKLE': return 'Inverse Farkle';
  }
}

function getRuleDescription(effect: RuleShardEffect): string {
  switch (effect.type) {
    case 'EVENS_ARE_ODDS': return `Even dice earn +${effect.bonusPerEven} each`;
    case 'PAIRS_PAY': return `Pairs earn +${effect.pairBonus} bonus`;
    case 'INVERSE_FARKLE': return 'Farkles grant 500 points!';
  }
}

function getRuleColor(effect: RuleShardEffect): string {
  switch (effect.type) {
    case 'EVENS_ARE_ODDS': return '#00ffcc';
    case 'PAIRS_PAY': return '#ffcc00';
    case 'INVERSE_FARKLE': return '#ff00ff';
  }
}

function getRuleIcon(effect: RuleShardEffect): string {
  switch (effect.type) {
    case 'EVENS_ARE_ODDS': return '⚗️';
    case 'PAIRS_PAY': return '🃏';
    case 'INVERSE_FARKLE': return '🔄';
  }
}

export interface RuleShardVisuals {
  ruleName: string;
  ruleDescription: string;
  timeRemainingMs: number;
  progress: number;
  color: string;
  icon: string;
  pulsing: boolean;
}
