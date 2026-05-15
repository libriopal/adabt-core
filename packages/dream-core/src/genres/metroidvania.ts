// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #2: METROIDVANIA (Ability-Gated Tiles)
// Sealed tiles on the 60-tile grid unlocked by rhythmic achievements.
// ─────────────────────────────────────────────────────

import type { SealedTile, SealCondition, SealReward, BeatAccuracy } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const TOTAL_TILES = 60;
const SEALED_TILE_COUNT = 12;   // 20% of the grid is sealed
const GLOW_PULSE_SPEED = 0.02;  // intensity per frame when near-unlock

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Generate sealed tiles for a match. Positions are distributed evenly.
 */
export function generateSealedTiles(
  rngFn: () => number,
  count: number = SEALED_TILE_COUNT,
): SealedTile[] {
  const conditions = generateConditions(rngFn, count);
  const rewards = generateRewards(rngFn, count);

  // Distribute positions evenly across the grid
  const spacing = Math.floor(TOTAL_TILES / count);
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    const base = i * spacing;
    const offset = Math.floor(rngFn() * spacing);
    positions.push(Math.min(TOTAL_TILES - 1, base + offset));
  }

  return positions.map((pos, i) => ({
    tileIndex: pos,
    condition: conditions[i]!,
    reward: rewards[i]!,
    sealed: true,
    glowIntensity: 0,
  }));
}

function generateConditions(rngFn: () => number, count: number): SealCondition[] {
  const templates: SealCondition[] = [
    { type: 'consecutive_on_beat', count: 3 },
    { type: 'consecutive_on_beat', count: 5 },
    { type: 'straight_4plus' },
    { type: 'exact_bank', target: 1000 },
    { type: 'exact_bank', target: 2500 },
    { type: 'exact_bank', target: 5000 },
    { type: 'streak', count: 3 },
    { type: 'streak', count: 5 },
  ];

  const conditions: SealCondition[] = [];
  for (let i = 0; i < count; i++) {
    conditions.push(templates[Math.floor(rngFn() * templates.length)]!);
  }
  return conditions;
}

function generateRewards(rngFn: () => number, count: number): SealReward[] {
  const templates: SealReward[] = [
    { type: 'multiplier', value: 1.5 },
    { type: 'multiplier', value: 2.0 },
    { type: 'free_reroll' },
    { type: 'wildcard_die' },
    { type: 'rule_shard', shardId: 'EVENS_ARE_ODDS' },
    { type: 'die_shard' },
    { type: 'acoustic_decoration', decorationId: 'CATHEDRAL_REVERB' },
    { type: 'acoustic_decoration', decorationId: 'VINYL_CRACKLE' },
  ];

  const rewards: SealReward[] = [];
  for (let i = 0; i < count; i++) {
    rewards.push(templates[Math.floor(rngFn() * templates.length)]!);
  }
  return rewards;
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Check if a sealed tile's condition has been met.
 */
export function checkSealCondition(
  condition: SealCondition,
  context: SealCheckContext,
): boolean {
  switch (condition.type) {
    case 'consecutive_on_beat':
      return context.consecutiveOnBeat >= condition.count;

    case 'straight_4plus':
      return context.hasStraight;

    case 'exact_bank':
      // Allow ±10% tolerance
      const tolerance = condition.target * 0.1;
      return Math.abs(context.lastBankAmount - condition.target) <= tolerance;

    case 'streak':
      return context.bankStreak >= condition.count;

    default:
      return false;
  }
}

/**
 * Attempt to unseal tiles based on current game context.
 * Returns updated sealed tiles and any granted rewards.
 */
export function attemptUnseal(
  sealedTiles: SealedTile[],
  context: SealCheckContext,
): {
  tiles: SealedTile[];
  grantedRewards: SealReward[];
  unsealed: number[];
} {
  const grantedRewards: SealReward[] = [];
  const unsealed: number[] = [];

  const updatedTiles = sealedTiles.map(tile => {
    if (!tile.sealed) return tile;

    if (checkSealCondition(tile.condition, context)) {
      grantedRewards.push(tile.reward);
      unsealed.push(tile.tileIndex);
      return {
        ...tile,
        sealed: false,
        glowIntensity: 1.0, // flash on unseal
      };
    }

    // Update glow intensity (pulse when near-unlock)
    const progress = estimateUnlockProgress(tile.condition, context);
    return {
      ...tile,
      glowIntensity: progress * 0.8, // max 0.8 glow until full unseal
    };
  });

  return { tiles: updatedTiles, grantedRewards, unsealed };
}

/**
 * Estimate how close the player is to unlocking a seal (0.0–1.0).
 */
function estimateUnlockProgress(
  condition: SealCondition,
  context: SealCheckContext,
): number {
  switch (condition.type) {
    case 'consecutive_on_beat':
      return Math.min(1.0, context.consecutiveOnBeat / condition.count);
    case 'straight_4plus':
      return context.hasStraight ? 1.0 : context.longestRun / 4;
    case 'exact_bank':
      return Math.min(1.0, context.lastBankAmount / condition.target);
    case 'streak':
      return Math.min(1.0, context.bankStreak / condition.count);
    default:
      return 0;
  }
}

/**
 * Tick glow pulse animation for sealed tiles.
 */
export function tickSealGlow(
  tiles: SealedTile[],
  deltaMs: number,
): SealedTile[] {
  return tiles.map(tile => {
    if (!tile.sealed) {
      // Fade out glow after unseal
      return {
        ...tile,
        glowIntensity: Math.max(0, tile.glowIntensity - GLOW_PULSE_SPEED * (deltaMs / 16.67)),
      };
    }
    return tile;
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SealCheckContext {
  consecutiveOnBeat: number;
  hasStraight: boolean;
  longestRun: number;
  lastBankAmount: number;
  bankStreak: number;
}
