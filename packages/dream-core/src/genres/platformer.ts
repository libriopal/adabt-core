// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #10: PLATFORMER (Gravity Flip)
// Grid rotates 90° every 5th turn with CSS physics settle.
// ─────────────────────────────────────────────────────

import type { GravityState, GravityDirection } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_FLIP_INTERVAL = 5;  // every 5 turns
const SETTLE_DURATION_MS = 400;   // CSS animation duration

const GRAVITY_SEQUENCE: GravityDirection[] = ['DOWN', 'RIGHT', 'UP', 'LEFT'];

// ── Factory ───────────────────────────────────────────────────────────────────
export function createGravityState(): GravityState {
  return {
    currentDirection: 'DOWN',
    turnsSinceFlip: 0,
    flipInterval: DEFAULT_FLIP_INTERVAL,
    settling: false,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Tick the gravity system at end of each turn.
 * Returns whether a flip occurred.
 */
export function tickGravity(state: GravityState): {
  state: GravityState;
  flipped: boolean;
  newDirection: GravityDirection;
} {
  const turnsSinceFlip = state.turnsSinceFlip + 1;

  if (turnsSinceFlip >= state.flipInterval) {
    const currentIdx = GRAVITY_SEQUENCE.indexOf(state.currentDirection);
    const nextIdx = (currentIdx + 1) % GRAVITY_SEQUENCE.length;
    const newDirection = GRAVITY_SEQUENCE[nextIdx]!;

    return {
      state: {
        currentDirection: newDirection,
        turnsSinceFlip: 0,
        flipInterval: state.flipInterval,
        settling: true,
      },
      flipped: true,
      newDirection,
    };
  }

  return {
    state: { ...state, turnsSinceFlip },
    flipped: false,
    newDirection: state.currentDirection,
  };
}

/**
 * Mark settling as complete (called after CSS animation finishes).
 */
export function finishSettling(state: GravityState): GravityState {
  return { ...state, settling: false };
}

/**
 * Get the CSS transform for the current gravity direction.
 */
export function getGravityTransform(direction: GravityDirection): string {
  switch (direction) {
    case 'DOWN': return 'rotate(0deg)';
    case 'RIGHT': return 'rotate(90deg)';
    case 'UP': return 'rotate(180deg)';
    case 'LEFT': return 'rotate(270deg)';
  }
}

/**
 * Get CSS transition properties for the settle animation.
 */
export function getSettleCSS(settling: boolean): Record<string, string> {
  return {
    transition: settling
      ? `transform ${SETTLE_DURATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`
      : 'none',
  };
}

/**
 * Recompute tile positions after a gravity flip.
 * Tiles "fall" in the new gravity direction.
 */
export function computeGravityPositions(
  tileCount: number,
  cols: number,
  direction: GravityDirection,
  occupiedTiles: Set<number>,
): Map<number, number> {
  const rows = Math.ceil(tileCount / cols);
  const result = new Map<number, number>();

  switch (direction) {
    case 'DOWN':
      // Normal: tiles fall down within each column
      for (let col = 0; col < cols; col++) {
        const colTiles: number[] = [];
        for (let row = 0; row < rows; row++) {
          const idx = row * cols + col;
          if (idx < tileCount && occupiedTiles.has(idx)) {
            colTiles.push(idx);
          }
        }
        // Stack from bottom
        for (let i = 0; i < colTiles.length; i++) {
          const newRow = rows - 1 - i;
          result.set(colTiles[colTiles.length - 1 - i]!, newRow * cols + col);
        }
      }
      break;

    case 'UP':
      // Inverted: tiles "fall" up
      for (let col = 0; col < cols; col++) {
        const colTiles: number[] = [];
        for (let row = rows - 1; row >= 0; row--) {
          const idx = row * cols + col;
          if (idx < tileCount && occupiedTiles.has(idx)) {
            colTiles.push(idx);
          }
        }
        for (let i = 0; i < colTiles.length; i++) {
          result.set(colTiles[colTiles.length - 1 - i]!, i * cols + col);
        }
      }
      break;

    case 'RIGHT':
      // Tiles fall rightward within each row
      for (let row = 0; row < rows; row++) {
        const rowTiles: number[] = [];
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          if (idx < tileCount && occupiedTiles.has(idx)) {
            rowTiles.push(idx);
          }
        }
        for (let i = 0; i < rowTiles.length; i++) {
          const newCol = cols - 1 - i;
          result.set(rowTiles[rowTiles.length - 1 - i]!, row * cols + newCol);
        }
      }
      break;

    case 'LEFT':
      // Tiles fall leftward within each row
      for (let row = 0; row < rows; row++) {
        const rowTiles: number[] = [];
        for (let col = cols - 1; col >= 0; col--) {
          const idx = row * cols + col;
          if (idx < tileCount && occupiedTiles.has(idx)) {
            rowTiles.push(idx);
          }
        }
        for (let i = 0; i < rowTiles.length; i++) {
          result.set(rowTiles[rowTiles.length - 1 - i]!, row * cols + i);
        }
      }
      break;
  }

  return result;
}
