// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #12: RACING (Slipstream)
// Trailing players get wider beat window; leaders narrower.
// ─────────────────────────────────────────────────────

import type { SlipstreamState } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const LEADER_WINDOW_MODIFIER = 0.75;   // 75ms effective (tighter)
const MIDDLE_WINDOW_MODIFIER = 1.0;    // 100ms (normal)
const TRAILING_WINDOW_MODIFIER = 1.5;  // 150ms (wider)
const LEADER_FLOW_CAP = 1.6;
const TRAILING_FLOW_CAP = 2.0;

// ── Factory ───────────────────────────────────────────────────────────────────
export function createSlipstreamState(totalPlayers: number = 2): SlipstreamState {
  return {
    playerPosition: 1,
    totalPlayers: Math.max(2, totalPlayers),
    beatWindowModifier: MIDDLE_WINDOW_MODIFIER,
    flowCapModifier: 1.0,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Update the slipstream state based on current standings.
 * Called whenever scores change in multiplayer.
 */
export function updateSlipstream(
  state: SlipstreamState,
  playerScore: number,
  allScores: number[],
): SlipstreamState {
  const sorted = [...allScores].sort((a, b) => b - a);
  const position = sorted.indexOf(playerScore) + 1;
  const totalPlayers = allScores.length;

  // Determine position category
  const positionRatio = (position - 1) / Math.max(1, totalPlayers - 1);

  let beatWindowModifier: number;
  let flowCapModifier: number;

  if (positionRatio <= 0.25) {
    // Leader pack: tighter window, lower flow cap
    beatWindowModifier = LEADER_WINDOW_MODIFIER;
    flowCapModifier = LEADER_FLOW_CAP / 2.0;
  } else if (positionRatio >= 0.75) {
    // Trailing pack: wider window, higher flow cap
    beatWindowModifier = TRAILING_WINDOW_MODIFIER;
    flowCapModifier = TRAILING_FLOW_CAP / 2.0;
  } else {
    // Middle pack: standard
    beatWindowModifier = MIDDLE_WINDOW_MODIFIER;
    flowCapModifier = 1.0;
  }

  return {
    playerPosition: position,
    totalPlayers,
    beatWindowModifier,
    flowCapModifier,
  };
}

/**
 * Get the effective beat window in ms, accounting for Slipstream.
 */
export function getEffectiveBeatWindow(
  baseBeatWindowMs: number,
  slipstream: SlipstreamState,
  classBeatWindowBonus: number = 0,
): number {
  return Math.round(baseBeatWindowMs * slipstream.beatWindowModifier + classBeatWindowBonus);
}

/**
 * Get the effective flow multiplier cap, accounting for Slipstream.
 */
export function getEffectiveFlowCap(
  baseFlowCap: number,
  slipstream: SlipstreamState,
): number {
  return baseFlowCap * slipstream.flowCapModifier;
}

/**
 * Get visual indicators for slipstream effects.
 */
export function getSlipstreamVisuals(state: SlipstreamState): SlipstreamVisuals {
  const isLeader = state.playerPosition === 1;
  const isTrailing = state.playerPosition === state.totalPlayers;

  return {
    position: state.playerPosition,
    totalPlayers: state.totalPlayers,
    indicator: isLeader ? 'PRESSURE' : isTrailing ? 'SLIPSTREAM' : 'CRUISE',
    color: isLeader ? '#ff4444' : isTrailing ? '#44ff44' : '#4444ff',
    beatWindowLabel: `${Math.round(100 * state.beatWindowModifier)}ms`,
    trailEffect: isTrailing,     // show speed lines
    pressureEffect: isLeader,    // show heat distortion
  };
}

export interface SlipstreamVisuals {
  position: number;
  totalPlayers: number;
  indicator: 'PRESSURE' | 'SLIPSTREAM' | 'CRUISE';
  color: string;
  beatWindowLabel: string;
  trailEffect: boolean;
  pressureEffect: boolean;
}
