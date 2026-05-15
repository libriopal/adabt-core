// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #4: RHYTHM (Perfect Beat Window)
// PRIORITY: 5th (Genre Hierarchy Position 5)
// The Pulse. All interactions quantized to BPM markers.
// ─────────────────────────────────────────────────────

import type { RhythmState, BeatAccuracy } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_BPM = 120;
const DEFAULT_BEAT_WINDOW_MS = 100;     // ±50ms from beat center
const PERFECT_WINDOW_MS = 40;           // ±20ms from beat center
const COMBO_FRENZY_THRESHOLD = 5;       // 5 consecutive Perfects
const FRENZY_DURATION_MS = 15000;       // 15 seconds
const FLOW_MULTIPLIER_MAX = 2.0;
const FLOW_MULTIPLIER_MIN = 1.0;
const FLOW_GAIN_PER_PERFECT = 0.1;
const FLOW_GAIN_PER_GOOD = 0.03;
const FLOW_LOSS_PER_MISS = 0.15;

// ── Factory ───────────────────────────────────────────────────────────────────
export function createRhythmState(bpm: number = DEFAULT_BPM): RhythmState {
  return {
    bpm,
    lastBeatTimestamp: 0,
    beatWindowMs: DEFAULT_BEAT_WINDOW_MS,
    comboStreak: 0,
    flowMultiplier: FLOW_MULTIPLIER_MIN,
    frenzyActive: false,
    frenzyExpiresAt: 0,
    beatPhase: 0,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Get the timestamp of the nearest beat marker.
 */
export function getNearestBeatMs(
  currentTimeMs: number,
  bpm: number,
  audioStartTimeMs: number,
): number {
  const beatIntervalMs = (60 / bpm) * 1000;
  const elapsed = currentTimeMs - audioStartTimeMs;
  const beatIndex = Math.round(elapsed / beatIntervalMs);
  return audioStartTimeMs + beatIndex * beatIntervalMs;
}

/**
 * Compute the beat phase (0.0–1.0) within the current beat.
 * 0.0 = on the beat, 0.5 = furthest from any beat.
 */
export function computeBeatPhase(
  currentTimeMs: number,
  bpm: number,
  audioStartTimeMs: number,
): number {
  const beatIntervalMs = (60 / bpm) * 1000;
  const elapsed = currentTimeMs - audioStartTimeMs;
  const phase = (elapsed % beatIntervalMs) / beatIntervalMs;
  // Normalize so 0.0 = on beat, 0.5 = off-beat
  return phase <= 0.5 ? phase : 1.0 - phase;
}

/**
 * Evaluate the accuracy of a roll action relative to the beat.
 * Returns PERFECT, GOOD, or MISS.
 */
export function evaluateBeatAccuracy(
  actionTimeMs: number,
  bpm: number,
  audioStartTimeMs: number,
  beatWindowMs: number = DEFAULT_BEAT_WINDOW_MS,
): BeatAccuracy {
  const nearestBeat = getNearestBeatMs(actionTimeMs, bpm, audioStartTimeMs);
  const offset = Math.abs(actionTimeMs - nearestBeat);

  if (offset <= PERFECT_WINDOW_MS / 2) return 'PERFECT';
  if (offset <= beatWindowMs / 2) return 'GOOD';
  return 'MISS';
}

/**
 * Quantize a roll trigger to the nearest beat.
 * Returns the delay in ms to wait before executing the roll.
 */
export function quantizeToNextBeat(
  currentTimeMs: number,
  bpm: number,
  audioStartTimeMs: number,
): { delayMs: number; targetBeatMs: number } {
  const beatIntervalMs = (60 / bpm) * 1000;
  const elapsed = currentTimeMs - audioStartTimeMs;
  const currentBeatIndex = Math.floor(elapsed / beatIntervalMs);
  const nextBeatMs = audioStartTimeMs + (currentBeatIndex + 1) * beatIntervalMs;
  const delayMs = Math.max(0, nextBeatMs - currentTimeMs);

  return { delayMs, targetBeatMs: nextBeatMs };
}

/**
 * Link rollDice trigger to the Web Audio clock.
 * Returns the AudioContext.currentTime for scheduling.
 */
export function getAudioClockRollTime(
  audioCtxCurrentTime: number,
  bpm: number,
): number {
  const beatIntervalSec = 60 / bpm;
  const currentBeat = Math.floor(audioCtxCurrentTime / beatIntervalSec);
  const nextBeat = (currentBeat + 1) * beatIntervalSec;
  return nextBeat;
}

/**
 * Update rhythm state after a roll with accuracy evaluation.
 */
export function processRollAccuracy(
  state: RhythmState,
  accuracy: BeatAccuracy,
  now: number = Date.now(),
): RhythmState {
  let { comboStreak, flowMultiplier, frenzyActive, frenzyExpiresAt } = state;

  switch (accuracy) {
    case 'PERFECT':
      comboStreak += 1;
      flowMultiplier = Math.min(
        FLOW_MULTIPLIER_MAX,
        flowMultiplier + FLOW_GAIN_PER_PERFECT,
      );
      break;

    case 'GOOD':
      // GOOD doesn't break combo but doesn't count toward Frenzy
      flowMultiplier = Math.min(
        FLOW_MULTIPLIER_MAX,
        flowMultiplier + FLOW_GAIN_PER_GOOD,
      );
      break;

    case 'MISS':
      comboStreak = 0;
      flowMultiplier = Math.max(
        FLOW_MULTIPLIER_MIN,
        flowMultiplier - FLOW_LOSS_PER_MISS,
      );
      frenzyActive = false;
      break;
  }

  // Check Frenzy activation
  if (comboStreak >= COMBO_FRENZY_THRESHOLD && !frenzyActive) {
    frenzyActive = true;
    frenzyExpiresAt = now + FRENZY_DURATION_MS;
  }

  // Check Frenzy expiry
  if (frenzyActive && now >= frenzyExpiresAt) {
    frenzyActive = false;
    frenzyExpiresAt = 0;
  }

  return {
    ...state,
    comboStreak,
    flowMultiplier,
    frenzyActive,
    frenzyExpiresAt,
  };
}

/**
 * Tick the rhythm state per frame. Updates beat phase and checks Frenzy expiry.
 */
export function tickRhythm(
  state: RhythmState,
  currentTimeMs: number,
  audioStartTimeMs: number,
): RhythmState {
  const beatPhase = computeBeatPhase(currentTimeMs, state.bpm, audioStartTimeMs);

  let { frenzyActive, frenzyExpiresAt } = state;
  if (frenzyActive && currentTimeMs >= frenzyExpiresAt) {
    frenzyActive = false;
    frenzyExpiresAt = 0;
  }

  return { ...state, beatPhase, frenzyActive, frenzyExpiresAt };
}

// ── Visual Beat Highway ───────────────────────────────────────────────────────

export interface BeatMarker {
  id: number;
  position: number;    // 0.0 = far, 1.0 = hit zone
  isCurrent: boolean;
}

/**
 * Generate beat markers for the visual beat highway.
 * Shows upcoming 4 beats traveling toward the hit zone.
 */
export function generateBeatMarkers(
  currentTimeMs: number,
  bpm: number,
  audioStartTimeMs: number,
  markerCount: number = 4,
): BeatMarker[] {
  const beatIntervalMs = (60 / bpm) * 1000;
  const elapsed = currentTimeMs - audioStartTimeMs;
  const currentBeatIndex = Math.floor(elapsed / beatIntervalMs);
  const beatProgress = (elapsed % beatIntervalMs) / beatIntervalMs;

  const markers: BeatMarker[] = [];
  for (let i = 0; i < markerCount; i++) {
    const position = 1.0 - (beatProgress + i) / markerCount;
    markers.push({
      id: currentBeatIndex + i,
      position: Math.max(0, Math.min(1, position)),
      isCurrent: i === 0,
    });
  }

  return markers;
}
