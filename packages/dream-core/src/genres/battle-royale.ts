// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #6: BATTLE ROYALE (Closing Circle)
// Grid contracts every 30s, scorched tiles lock dice values.
// ─────────────────────────────────────────────────────

import type { ClosingCircleState } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const INITIAL_RADIUS = 10;               // full grid
const MIN_RADIUS = 3;                    // minimum safe zone
const DEFAULT_SHRINK_INTERVAL_MS = 30000; // 30 seconds
const TILES_PER_SHRINK = 6;             // tiles scorched per contraction

// ── Factory ───────────────────────────────────────────────────────────────────
export function createClosingCircleState(): ClosingCircleState {
  const scorchedSet = new Set<number>();
  return {
    radius: INITIAL_RADIUS,
    tickIntervalMs: DEFAULT_SHRINK_INTERVAL_MS,
    lastShrinkAt: Date.now(),
    scorchedTiles: scorchedSet,
    scorched: scorchedSet,
    active: false,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Tick the Closing Circle. Contracts the safe zone at fixed intervals.
 */
export function tickClosingCircle(
  state: ClosingCircleState,
  now: number,
  totalTiles: number = 60,
  rngFn: () => number = deterministicCircleRng,
): ClosingCircleState {
  if (now - state.lastShrinkAt < state.tickIntervalMs) return state;
  if (state.radius <= MIN_RADIUS) return state;

  const newRadius = Math.max(MIN_RADIUS, state.radius - 1);
  const newScorched = new Set(state.scorchedTiles);

  // Scorch tiles from the outer rim
  const outerTiles = getOuterRimTiles(state.scorchedTiles, totalTiles, rngFn);
  for (const tile of outerTiles.slice(0, TILES_PER_SHRINK)) {
    newScorched.add(tile);
  }

  return {
    radius: newRadius,
    tickIntervalMs: state.tickIntervalMs,
    lastShrinkAt: now,
    scorchedTiles: newScorched,
    scorched: newScorched,
    active: newRadius > MIN_RADIUS,
  };
}

let circleRngState = 0xC10C1E;
function deterministicCircleRng(): number {
  circleRngState = (circleRngState + 0x6D2B79F5) >>> 0;
  let t = circleRngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Get tiles on the outer rim that haven't been scorched yet.
 * Prioritizes corners and edges.
 */
function getOuterRimTiles(
  existing: Set<number>,
  totalTiles: number,
  rngFn: () => number,
): number[] {
  const cols = 10;
  const rows = Math.ceil(totalTiles / cols);
  const candidates: number[] = [];

  // Priority: corners first, then edges, then inner
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= totalTiles) continue;
      if (existing.has(idx)) continue;

      const isEdge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
      const isCorner = (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);

      if (isCorner) candidates.unshift(idx); // highest priority
      else if (isEdge) candidates.push(idx);
    }
  }

  // If no edges left, take inner tiles adjacent to scorched
  if (candidates.length === 0) {
    for (let i = 0; i < totalTiles; i++) {
      if (existing.has(i)) continue;
      const neighbors = getCardinalNeighbors(i, cols, totalTiles);
      if (neighbors.some(n => existing.has(n))) {
        candidates.push(i);
      }
    }
  }

  // Shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rngFn() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }

  return candidates;
}

function getCardinalNeighbors(idx: number, cols: number, total: number): number[] {
  const row = Math.floor(idx / cols);
  const col = idx % cols;
  const neighbors: number[] = [];

  if (row > 0) neighbors.push((row - 1) * cols + col);
  if (row < Math.ceil(total / cols) - 1) neighbors.push((row + 1) * cols + col);
  if (col > 0) neighbors.push(row * cols + col - 1);
  if (col < cols - 1) neighbors.push(row * cols + col + 1);

  return neighbors.filter(n => n >= 0 && n < total);
}

/**
 * Check if a tile is scorched (no actions allowed on scorched tiles).
 */
export function isTileScorched(state: ClosingCircleState, tileIndex: number): boolean {
  return state.scorchedTiles.has(tileIndex);
}

/**
 * Get visual parameters for the scorched overlay.
 */
export function getScorchedVisuals(state: ClosingCircleState): ScorchedVisuals {
  const intensity = 1.0 - (state.radius - MIN_RADIUS) / (INITIAL_RADIUS - MIN_RADIUS);
  return {
    scorchedTileIndices: [...state.scorchedTiles],
    overlayColor: `rgba(255, 60, 20, ${0.3 + intensity * 0.4})`,
    borderColor: intensity > 0.7 ? '#ff1100' : '#ff6600',
    borderGlow: intensity > 0.7 ? '#ff1100' : '#ff6600',
    warningPulse: intensity > 0.5,
    pulseSpeed: 1.0 + intensity * 2.0,
  };
}

export interface ScorchedVisuals {
  scorchedTileIndices: number[];
  overlayColor: string;
  borderColor: string;
  borderGlow: string;
  warningPulse: boolean;
  pulseSpeed: number;
}

/**
 * Serialize/deserialize for network state (Sets aren't JSON-safe).
 */
export function serializeCircleState(state: ClosingCircleState): object {
  return {
    ...state,
    scorchedTiles: [...state.scorchedTiles],
  };
}

export function deserializeCircleState(data: any): ClosingCircleState {
  return {
    ...data,
    scorchedTiles: new Set(data.scorchedTiles),
  };
}
