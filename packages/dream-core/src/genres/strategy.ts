// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #13: STRATEGY (Territory Control)
// 6 territories, claimed by banking; passive +5% per territory.
// ─────────────────────────────────────────────────────

import type { Territory, TerritoryState } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const TERRITORY_COUNT = 6;
const TILES_PER_TERRITORY = 10;    // 60 / 6
const BONUS_PER_TERRITORY = 0.05;  // +5% per claimed territory
const DOMAIN_THRESHOLD = 3;        // 3+ adjacent territories = Domain bonus
const DOMAIN_BONUS = 0.10;         // additional 10% for Domain

// ── Factory ───────────────────────────────────────────────────────────────────

export function createTerritoryState(): TerritoryState {
  const territories: Territory[] = [];

  for (let i = 0; i < TERRITORY_COUNT; i++) {
    const tileIndices: number[] = [];
    for (let j = 0; j < TILES_PER_TERRITORY; j++) {
      tileIndices.push(i * TILES_PER_TERRITORY + j);
    }
    territories.push({
      id: i,
      tileIndices,
      ownerId: null,
      contested: false,
      domainActive: false,
    });
  }

  return {
    territories,
    playerBonusMultiplier: 1.0,
  };
}

// ── Adjacency Map ─────────────────────────────────────────────────────────────
// Territories are arranged in a 3×2 grid:
//  [0] [1] [2]
//  [3] [4] [5]
const TERRITORY_ADJACENCY: Record<number, number[]> = {
  0: [1, 3],
  1: [0, 2, 3, 4],
  2: [1, 4, 5],
  3: [0, 1, 4],
  4: [1, 2, 3, 5],
  5: [2, 4],
};

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Claim a territory by banking while dice are on it.
 * A territory is claimed if the player has the majority of active dice in it.
 */
export function claimTerritory(
  state: TerritoryState,
  territoryId: number,
  playerId: string,
): TerritoryState {
  const territories = state.territories.map(t => {
    if (t.id !== territoryId) return t;

    if (t.ownerId === playerId) return t; // already owned

    return {
      ...t,
      ownerId: playerId,
      contested: t.ownerId !== null && t.ownerId !== playerId,
    };
  });

  // Recalculate domain status and bonus multiplier
  return recalculateBonuses(territories, playerId);
}

/**
 * Contest a territory (opponent claims it).
 */
export function contestTerritory(
  state: TerritoryState,
  territoryId: number,
  attackerId: string,
): TerritoryState {
  const territories = state.territories.map(t => {
    if (t.id !== territoryId) return t;
    if (t.ownerId === attackerId) return t;

    return {
      ...t,
      ownerId: attackerId,
      contested: true,
    };
  });

  return recalculateBonuses(territories, attackerId);
}

/**
 * Determine which territory a tile belongs to.
 */
export function getTerritoryForTile(tileIndex: number): number {
  return Math.floor(tileIndex / TILES_PER_TERRITORY);
}

/**
 * Count territories owned by a player.
 */
export function countOwnedTerritories(
  state: TerritoryState,
  playerId: string,
): number {
  return state.territories.filter(t => t.ownerId === playerId).length;
}

/**
 * Check if a player has a Domain (3+ adjacent territories).
 */
function checkDomain(territories: Territory[], playerId: string): boolean {
  const owned = new Set(
    territories.filter(t => t.ownerId === playerId).map(t => t.id)
  );

  if (owned.size < DOMAIN_THRESHOLD) return false;

  // BFS: find a connected cluster of owned territories
  for (const startId of owned) {
    const visited = new Set<number>();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = TERRITORY_ADJACENCY[current] ?? [];
      for (const neighbor of neighbors) {
        if (owned.has(neighbor) && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    if (visited.size >= DOMAIN_THRESHOLD) return true;
  }

  return false;
}

function recalculateBonuses(
  territories: Territory[],
  playerId: string,
): TerritoryState {
  const ownedCount = territories.filter(t => t.ownerId === playerId).length;
  const hasDomain = checkDomain(territories, playerId);

  const updatedTerritories = territories.map(t => ({
    ...t,
    domainActive: t.ownerId === playerId && hasDomain,
  }));

  const bonus = 1.0 + ownedCount * BONUS_PER_TERRITORY + (hasDomain ? DOMAIN_BONUS : 0);

  return {
    territories: updatedTerritories,
    playerBonusMultiplier: bonus,
  };
}

/**
 * Get visual state for the territory overlay.
 */
export function getTerritoryVisuals(
  state: TerritoryState,
  playerId: string,
): TerritoryVisuals {
  return {
    territories: state.territories.map(t => ({
      id: t.id,
      tileIndices: t.tileIndices,
      owned: t.ownerId === playerId,
      contested: t.contested,
      domainActive: t.domainActive,
      color: t.ownerId === playerId
        ? (t.domainActive ? '#00ffcc' : '#00aa88')
        : t.ownerId !== null
          ? '#ff4444'
          : '#333333',
      borderStyle: t.contested ? 'dashed' : 'solid',
    })),
    bonusLabel: `+${Math.round((state.playerBonusMultiplier - 1.0) * 100)}%`,
    hasDomain: state.territories.some(t => t.domainActive),
  };
}

export interface TerritoryVisuals {
  territories: {
    id: number;
    tileIndices: number[];
    owned: boolean;
    contested: boolean;
    domainActive: boolean;
    color: string;
    borderStyle: string;
  }[];
  bonusLabel: string;
  hasDomain: boolean;
}
