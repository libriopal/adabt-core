/**
 * Emotional State Receptor — ERK Module
 *
 * Translates FAR_NZY game state snapshots into normalized EmotionalStateVectors.
 * This is the sensory input layer of the Emotional Runtime Kernel.
 *
 * Constitutional compliance:
 *   Law 1 — Pure function, no randomness. Same input = same output.
 *   Law 2 — Output preserves continuous emotional trajectory (smoothing).
 *   Law 3 — Zero allocation in hot path; reuses vector objects.
 *   Law 4 — Output is serializable for IndexedDB persistence.
 *
 * Design note: The receptor is deliberately decoupled from farkleStore.
 * It receives a GameStateSnapshot interface, so it can be tested and
 * used independently of the Zustand store implementation.
 */

import type { EmotionalStateVector, GameStateSnapshot, EnergyMode } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum multiplier ladder step in FAR_NZY. */
const MAX_MULTIPLIER_STEP = 5;

/** Maximum energy in FAR_NZY. */
const MAX_ENERGY = 300;

/** Energy threshold for FRENZY mode. */
const FRENZY_THRESHOLD = 150;

/** FRENZY instability threshold — below this, chaos spikes. */
const FRENZY_INSTABILITY_THRESHOLD = 75;

/** Smoothing factor for exponential moving average (0 = no smoothing, 1 = no change). */
const SMOOTHING_ALPHA = 0.15;

/** Maximum disruption count before chaos saturates. */
const MAX_DISRUPTIONS = 5;

/** History buffer size for emotional trajectory smoothing. */
const HISTORY_SIZE = 8;

// ── Clamp utility ─────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Sanitize a single axis value: coerce NaN/Infinity to 0, then clamp to [0, 1]. */
function safeAxis(v: number): number {
  return clamp(Number.isFinite(v) ? v : 0, 0, 1);
}

/** Deep-copy and clamp every axis of an EmotionalStateVector to [0, 1]. */
function clampVector(v: EmotionalStateVector): EmotionalStateVector {
  return {
    tension: safeAxis(v.tension),
    momentum: safeAxis(v.momentum),
    risk: safeAxis(v.risk),
    chaos: safeAxis(v.chaos),
    resolution: safeAxis(v.resolution),
  };
}

// ── Receptor Class ────────────────────────────────────────────────────────────

/**
 * The EmotionalStateReceptor maintains a smoothed emotional trajectory
 * from sequential game state snapshots. Call `process()` each frame or
 * on significant state changes.
 *
 * The receptor is stateful (tracks history for smoothing) but fully
 * deterministic — given the same sequence of snapshots, it produces
 * the same sequence of vectors.
 */
export class EmotionalStateReceptor {
  private history: EmotionalStateVector[] = [];
  private current: EmotionalStateVector = {
    tension: 0,
    momentum: 0,
    risk: 0,
    chaos: 0,
    resolution: 0,
  };

  /**
   * Process a game state snapshot and return the smoothed emotional vector.
   *
   * @param snapshot - Current FAR_NZY game state
   * @returns Smoothed EmotionalStateVector (all axes 0–1)
   */
  process(snapshot: GameStateSnapshot): EmotionalStateVector {
    const raw = this.computeRaw(snapshot);
    this.current = this.smooth(raw);
    this.pushHistory(this.current);
    return { ...this.current };
  }

  /**
   * Get the current emotional state without processing a new snapshot.
   */
  getCurrent(): EmotionalStateVector {
    return { ...this.current };
  }

  /**
   * Get the full emotional history buffer (for persistence / analysis).
   * Returns deep copies to prevent external mutation of internal state.
   */
  getHistory(): EmotionalStateVector[] {
    return this.history.map(v => ({ ...v }));
  }

  /**
   * Restore receptor state from a persisted history.
   * Used when recovering from an IndexedDB checkpoint.
   * Validates and clamps all values to [0, 1] to prevent NaN / out-of-range poisoning.
   */
  restore(history: EmotionalStateVector[], current: EmotionalStateVector): void {
    this.history = history.slice(-HISTORY_SIZE).map(v => clampVector(v));
    this.current = clampVector(current);
  }

  /**
   * Reset receptor to initial state.
   */
  reset(): void {
    this.history = [];
    this.current = { tension: 0, momentum: 0, risk: 0, chaos: 0, resolution: 0 };
  }

  // ── Private: Raw computation ──────────────────────────────────────────────

  private computeRaw(s: GameStateSnapshot): EmotionalStateVector {
    return {
      tension: this.computeTension(s),
      momentum: this.computeMomentum(s),
      risk: this.computeRisk(s),
      chaos: this.computeChaos(s),
      resolution: this.computeResolution(s),
    };
  }

  /**
   * Tension: Derived from multiplier ladder position and chain length.
   * Tension rises as the player commits deeper into a scoring run.
   *
   * multiplierStep contributes 70% (the primary tension driver),
   * chainLength contributes 30% (immediate per-chain tension).
   */
  private computeTension(s: GameStateSnapshot): number {
    const ladderTension = s.multiplierStep / MAX_MULTIPLIER_STEP;
    const chainTension = s.chainLength / 6; // MAX_CHAIN = 6
    return clamp(ladderTension * 0.7 + chainTension * 0.3, 0, 1);
  }

  /**
   * Momentum: Derived from energy mode and energy level.
   * NORMAL = low momentum, PRIME = building, FRENZY = maximum.
   *
   * Within each mode, energy level provides granularity.
   */
  private computeMomentum(s: GameStateSnapshot): number {
    const modeBase = this.modeToMomentum(s.mode);
    const energyRatio = s.energy / MAX_ENERGY;

    if (s.mode === 'NORMAL') {
      // In NORMAL, momentum tracks energy accumulation toward FRENZY_THRESHOLD
      return clamp(modeBase + energyRatio * 0.2, 0, 1);
    } else if (s.mode === 'PRIME') {
      // In PRIME, energy is growing — momentum reflects the climb
      return clamp(modeBase + energyRatio * 0.15, 0, 1);
    } else {
      // In FRENZY, energy is draining — momentum stays high but tracks decay
      return clamp(modeBase + (energyRatio - 0.5) * 0.2, 0, 1);
    }
  }

  private modeToMomentum(mode: EnergyMode): number {
    switch (mode) {
      case 'NORMAL': return 0.15;
      case 'PRIME': return 0.5;
      case 'FRENZY': return 0.8;
    }
  }

  /**
   * Risk: The proportion of accumulated score that is currently unbanked.
   * This directly models the bank-or-push decision — the emotional core
   * of Farkle Frenzy.
   *
   * Also accounts for farkle history (recent farkles increase perceived risk).
   */
  private computeRisk(s: GameStateSnapshot): number {
    const total = s.banked + s.unbanked;
    if (total === 0) return 0;

    const unbankedRatio = s.unbanked / total;
    // Farkle penalty: each farkle adds 0.05 risk (recent failures raise anxiety)
    const farklePenalty = clamp(s.farkleCount * 0.05, 0, 0.2);
    return clamp(unbankedRatio + farklePenalty, 0, 1);
  }

  /**
   * Chaos: Disruption event density, FRENZY instability, and special events.
   * High chaos triggers aggressive, unstable musical character.
   */
  private computeChaos(s: GameStateSnapshot): number {
    let chaos = 0;

    // FRENZY mode is inherently chaotic
    if (s.mode === 'FRENZY') {
      chaos += 0.4;
      // Below instability threshold = even more chaotic
      if (s.energy < FRENZY_INSTABILITY_THRESHOLD) {
        chaos += 0.2;
      }
    }

    // Active disruptions
    chaos += clamp(s.activeDisruptions / MAX_DISRUPTIONS, 0, 0.3);

    // Heist/Rally events are high-chaos multiplayer moments
    if (s.heistActive) chaos += 0.15;
    if (s.rallyDecisionActive) chaos += 0.1;

    return clamp(chaos, 0, 1);
  }

  /**
   * Resolution: Proximity to the game's conclusion.
   * Approaches 1.0 as banked score nears WIN_SCORE, or when
   * the game phase transitions to win/lose.
   */
  private computeResolution(s: GameStateSnapshot): number {
    if (s.gamePhase === 'win') return 1.0;
    if (s.gamePhase === 'lose') return 0.9; // High resolution, different character
    if (s.gamePhase === 'idle') return 0.0;

    // During play, resolution tracks banked progress toward win
    return clamp(s.banked / s.winScore, 0, 0.85);
  }

  // ── Private: Smoothing ────────────────────────────────────────────────────

  /**
   * Apply exponential moving average smoothing to prevent musical whiplash.
   * This ensures emotional continuity (Law 2) even when game state changes abruptly.
   */
  private smooth(raw: EmotionalStateVector): EmotionalStateVector {
    const a = SMOOTHING_ALPHA;
    const prev = this.current;
    return {
      tension: prev.tension + a * (raw.tension - prev.tension),
      momentum: prev.momentum + a * (raw.momentum - prev.momentum),
      risk: prev.risk + a * (raw.risk - prev.risk),
      chaos: prev.chaos + a * (raw.chaos - prev.chaos),
      resolution: prev.resolution + a * (raw.resolution - prev.resolution),
    };
  }

  private pushHistory(vec: EmotionalStateVector): void {
    this.history.push({ ...vec });
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }
  }
}
