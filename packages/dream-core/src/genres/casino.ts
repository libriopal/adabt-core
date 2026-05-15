// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #9: CASINO (Volatility Surge)
// PRIORITY: 3rd (Genre Hierarchy Position 3)
// High-volatility math drives the Neon Oscilloscope.
// ─────────────────────────────────────────────────────

import type { VolatilityState } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const HISTORY_SIZE = 5;
const VARIANCE_THRESHOLD = 150000;   // variance value that triggers Surge
const SURGE_DURATION_MS = 30000;     // 30 seconds of amplified juice
const MIN_FARKLES_FOR_SURGE = 3;     // need 3+ Farkles in window
const MIN_HIGH_SCORE = 2000;         // need at least 1 score > 2000

// ── Factory ───────────────────────────────────────────────────────────────────
export function createVolatilityState(): VolatilityState {
  return {
    recentScores: [],
    variance: 0,
    standardDeviation: 0,
    surgeActive: false,
    surgeExpiresAt: 0,
    juiceAmplifier: 1.0,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Record a roll result into the volatility tracker.
 * Score of 0 = Farkle. Positive = scoring roll.
 */
export function recordRollResult(
  state: VolatilityState,
  score: number,
  now: number = Date.now(),
): VolatilityState {
  // Ring buffer: keep last HISTORY_SIZE scores
  const scores = [...state.recentScores, score];
  if (scores.length > HISTORY_SIZE) scores.shift();

  // Compute variance
  const variance = computeVariance(scores);

  // Check surge conditions
  const farkleCount = scores.filter(s => s === 0).length;
  const hasHighScore = scores.some(s => s >= MIN_HIGH_SCORE);
  const shouldSurge = farkleCount >= MIN_FARKLES_FOR_SURGE &&
                      hasHighScore &&
                      variance >= VARIANCE_THRESHOLD;

  // Activate or maintain surge
  let surgeActive = state.surgeActive;
  let surgeExpiresAt = state.surgeExpiresAt;

  if (shouldSurge && !state.surgeActive) {
    surgeActive = true;
    surgeExpiresAt = now + SURGE_DURATION_MS;
  }

  // Check expiry
  if (surgeActive && now >= surgeExpiresAt) {
    surgeActive = false;
    surgeExpiresAt = 0;
  }

  return {
    recentScores: scores,
    variance,
    standardDeviation: Math.sqrt(variance),
    surgeActive,
    surgeExpiresAt,
    juiceAmplifier: surgeActive ? 2.0 : 1.0,
  };
}

/**
 * Tick the volatility state (call per frame or per event).
 */
export function tickVolatility(
  state: VolatilityState,
  now: number = Date.now(),
): VolatilityState {
  if (state.surgeActive && now >= state.surgeExpiresAt) {
    return {
      ...state,
      surgeActive: false,
      surgeExpiresAt: 0,
      juiceAmplifier: 1.0,
    };
  }
  return state;
}

/**
 * Get oscilloscope visual parameters based on volatility.
 */
export function getOscilloscopeParams(state: VolatilityState): OscilloscopeParams {
  const normalizedVariance = Math.min(1.0, state.variance / (VARIANCE_THRESHOLD * 2));

  if (state.surgeActive) {
    return {
      color: interpolateColor('#00ffff', '#ff00ff', normalizedVariance),
      amplitude: 1.0 + normalizedVariance * 2.0,
      frequency: 1.0 + normalizedVariance * 3.0,
      waveformDistortion: normalizedVariance * 0.8,
      glowIntensity: 0.8 + normalizedVariance * 0.2,
      particleDensity: 2.0,
    };
  }

  return {
    color: interpolateColor('#0066cc', '#00ffff', normalizedVariance),
    amplitude: 0.3 + normalizedVariance * 0.7,
    frequency: 0.5 + normalizedVariance * 1.5,
    waveformDistortion: normalizedVariance * 0.3,
    glowIntensity: 0.2 + normalizedVariance * 0.4,
    particleDensity: 0.5 + normalizedVariance * 0.5,
  };
}

// ── Cascade System (Chain-Reaction Juice) ─────────────────────────────────────

export interface CascadeEvent {
  depth: number;
  scorePerLevel: number[];
  shakeIntensity: number;
  particleMultiplier: number;
  audioStemIntensity: number;
}

/**
 * Compute cascade visual/audio parameters from a chain reaction.
 * Each level doubles the intensity.
 */
export function computeCascade(
  chainDepth: number,
  baseScore: number,
  volatilityAmplifier: number,
): CascadeEvent {
  const scorePerLevel: number[] = [];
  for (let i = 0; i < chainDepth; i++) {
    scorePerLevel.push(Math.round(baseScore * Math.pow(1.5, i)));
  }

  return {
    depth: chainDepth,
    scorePerLevel,
    shakeIntensity: Math.min(1.0, chainDepth * 0.15 * volatilityAmplifier),
    particleMultiplier: Math.pow(2, chainDepth - 1) * volatilityAmplifier,
    audioStemIntensity: Math.min(1.0, chainDepth * 0.2 * volatilityAmplifier),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeVariance(scores: number[]): number {
  if (scores.length < 2) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sumSquaredDiffs = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0);
  return sumSquaredDiffs / scores.length;
}

function interpolateColor(from: string, to: string, t: number): string {
  const f = hexToRgb(from);
  const tt = hexToRgb(to);
  const r = Math.round(f.r + (tt.r - f.r) * t);
  const g = Math.round(f.g + (tt.g - f.g) * t);
  const b = Math.round(f.b + (tt.b - f.b) * t);
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OscilloscopeParams {
  color: string;
  amplitude: number;
  frequency: number;
  waveformDistortion: number;
  glowIntensity: number;
  particleDensity: number;
}
