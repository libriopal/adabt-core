// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #5: MATCH-3 (Phantasmagoric Chain)
// PRIORITY: 4th (Genre Hierarchy Position 4)
// Grid neighbor-detection and chain-clears.
// ─────────────────────────────────────────────────────

import type { ChainReaction, SealedTile } from '../types';
import type { DieFace } from '../../farkle-shared/src/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const GRID_COLS = 10;       // 10×6 = 60 tiles default
const GRID_ROWS = 6;
const MIN_MATCH_LENGTH = 3; // minimum chain for a match
const CHAIN_SCORE_MULTIPLIER = 1.5; // each depth level multiplies

// ── Grid Coordinate Utilities ─────────────────────────────────────────────────

export function tileToGrid(tileIndex: number): { row: number; col: number } {
  return {
    row: Math.floor(tileIndex / GRID_COLS),
    col: tileIndex % GRID_COLS,
  };
}

export function gridToTile(row: number, col: number): number {
  return row * GRID_COLS + col;
}

export function isValidTile(row: number, col: number): boolean {
  return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
}

/**
 * Get orthogonal neighbors (up, down, left, right) of a tile.
 */
export function getNeighbors(tileIndex: number): number[] {
  const { row, col } = tileToGrid(tileIndex);
  const neighbors: number[] = [];

  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of offsets) {
    const nr = row + dr!;
    const nc = col + dc!;
    if (isValidTile(nr, nc)) {
      neighbors.push(gridToTile(nr, nc));
    }
  }

  return neighbors;
}

/**
 * Get all 8 surrounding neighbors (including diagonals).
 */
export function getNeighbors8(tileIndex: number): number[] {
  const { row, col } = tileToGrid(tileIndex);
  const neighbors: number[] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (isValidTile(nr, nc)) {
        neighbors.push(gridToTile(nr, nc));
      }
    }
  }

  return neighbors;
}

// ── Match Detection ───────────────────────────────────────────────────────────

export interface TileState {
  index: number;
  face: DieFace | null;
  occupied: boolean;
  scorched: boolean;    // from Closing Circle
  sealed: boolean;      // from Metroidvania
}

/**
 * Detect horizontal matches on the grid (3+ same face in a row).
 */
export function detectHorizontalMatches(tiles: TileState[]): number[][] {
  const matches: number[][] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    let run: number[] = [];
    let currentFace: DieFace | null = null;

    for (let col = 0; col < GRID_COLS; col++) {
      const tile = tiles[gridToTile(row, col)];
      if (!tile || !tile.occupied || tile.face === null || tile.scorched) {
        if (run.length >= MIN_MATCH_LENGTH) matches.push([...run]);
        run = [];
        currentFace = null;
        continue;
      }

      if (tile.face === currentFace) {
        run.push(tile.index);
      } else {
        if (run.length >= MIN_MATCH_LENGTH) matches.push([...run]);
        run = [tile.index];
        currentFace = tile.face;
      }
    }
    if (run.length >= MIN_MATCH_LENGTH) matches.push([...run]);
  }

  return matches;
}

/**
 * Detect vertical matches on the grid (3+ same face in a column).
 */
export function detectVerticalMatches(tiles: TileState[]): number[][] {
  const matches: number[][] = [];

  for (let col = 0; col < GRID_COLS; col++) {
    let run: number[] = [];
    let currentFace: DieFace | null = null;

    for (let row = 0; row < GRID_ROWS; row++) {
      const tile = tiles[gridToTile(row, col)];
      if (!tile || !tile.occupied || tile.face === null || tile.scorched) {
        if (run.length >= MIN_MATCH_LENGTH) matches.push([...run]);
        run = [];
        currentFace = null;
        continue;
      }

      if (tile.face === currentFace) {
        run.push(tile.index);
      } else {
        if (run.length >= MIN_MATCH_LENGTH) matches.push([...run]);
        run = [tile.index];
        currentFace = tile.face;
      }
    }
    if (run.length >= MIN_MATCH_LENGTH) matches.push([...run]);
  }

  return matches;
}

/**
 * Detect "Small Straight" patterns (1-2-3-4 or 2-3-4-5 or 3-4-5-6)
 * in horizontal or vertical lines.
 */
export function detectStraightPatterns(tiles: TileState[]): number[][] {
  const straights: number[][] = [];

  // Check horizontal straights
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let startCol = 0; startCol <= GRID_COLS - 4; startCol++) {
      const indices: number[] = [];
      const faces: DieFace[] = [];

      for (let col = startCol; col < startCol + 4; col++) {
        const tile = tiles[gridToTile(row, col)];
        if (!tile || !tile.occupied || tile.face === null) break;
        indices.push(tile.index);
        faces.push(tile.face);
      }

      if (faces.length === 4 && isConsecutive(faces)) {
        straights.push(indices);
      }
    }
  }

  // Check vertical straights
  for (let col = 0; col < GRID_COLS; col++) {
    for (let startRow = 0; startRow <= GRID_ROWS - 4; startRow++) {
      const indices: number[] = [];
      const faces: DieFace[] = [];

      for (let row = startRow; row < startRow + 4; row++) {
        const tile = tiles[gridToTile(row, col)];
        if (!tile || !tile.occupied || tile.face === null) break;
        indices.push(tile.index);
        faces.push(tile.face);
      }

      if (faces.length === 4 && isConsecutive(faces)) {
        straights.push(indices);
      }
    }
  }

  return straights;
}

function isConsecutive(faces: DieFace[]): boolean {
  const sorted = [...faces].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! - sorted[i - 1]! !== 1) return false;
  }
  return true;
}

// ── Chain Reaction (Phantasmagoric) ───────────────────────────────────────────

/**
 * BFS chain reaction from matched tiles.
 * Each level: check neighbors for additional matches.
 * Unseals any Metroidvania tiles caught in the blast.
 */
export function executeChainReaction(
  matchedTiles: number[],
  allTiles: TileState[],
  sealedTiles: SealedTile[],
  maxDepth: number = 5,
): ChainReaction {
  const affected = new Set<number>(matchedTiles);
  const unsealed: number[] = [];
  let depth = 0;
  let frontier = [...matchedTiles];

  while (frontier.length > 0 && depth < maxDepth) {
    depth++;
    const nextFrontier: number[] = [];

    for (const tileIdx of frontier) {
      const neighbors = getNeighbors(tileIdx);
      for (const neighborIdx of neighbors) {
        if (affected.has(neighborIdx)) continue;

        const tile = allTiles[neighborIdx];
        if (!tile || !tile.occupied) continue;

        // Check if this neighbor would form a new match
        const tileNeighbors = getNeighbors(neighborIdx)
          .filter(n => affected.has(n))
          .map(n => allTiles[n])
          .filter((t): t is TileState => t !== undefined && t.face !== null);

        if (tileNeighbors.some(t => t.face === tile.face)) {
          affected.add(neighborIdx);
          nextFrontier.push(neighborIdx);
        }
      }
    }

    // Check for sealed tiles caught in the blast
    for (const sealedTile of sealedTiles) {
      if (sealedTile.sealed && affected.has(sealedTile.tileIndex)) {
        unsealed.push(sealedTile.tileIndex);
      }
    }

    frontier = nextFrontier;
  }

  return {
    chainDepth: depth,
    tilesAffected: [...affected],
    unsealsTriggered: unsealed,
    visualIntensity: Math.min(5.0, depth * 1.0),
  };
}

// ── Board Clear ───────────────────────────────────────────────────────────────

/**
 * Perform a board-clear triggered by a Straight pattern.
 * Clears all tiles in the matched rows/columns.
 */
export function executeBoardClear(
  straightTiles: number[],
  allTiles: TileState[],
): { clearedTiles: number[]; isFullClear: boolean } {
  // Determine if the straight is horizontal or vertical
  const positions = straightTiles.map(t => tileToGrid(t));
  const isHorizontal = positions.every(p => p.row === positions[0]!.row);

  const cleared = new Set<number>(straightTiles);

  if (isHorizontal) {
    // Clear entire row
    const row = positions[0]!.row;
    for (let col = 0; col < GRID_COLS; col++) {
      cleared.add(gridToTile(row, col));
    }
  } else {
    // Clear entire column
    const col = positions[0]!.col;
    for (let row = 0; row < GRID_ROWS; row++) {
      cleared.add(gridToTile(row, col));
    }
  }

  const clearedTiles = [...cleared].filter(idx => {
    const tile = allTiles[idx];
    return tile && tile.occupied && !tile.scorched;
  });

  return {
    clearedTiles,
    isFullClear: clearedTiles.length >= 55, // ~92% of tiles
  };
}
