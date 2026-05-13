/**
 * Emotional Runtime Kernel — Public API
 *
 * The ERK is the bridge between FAR_NZY gameplay state and adabt-core's
 * deterministic music orchestration system.
 *
 * Usage:
 *   import { ERK } from './erk';
 *   const erk = new ERK(sessionSeed);
 *   // Each frame or state change:
 *   const result = erk.update(gameStateSnapshot);
 *   // result contains: emotional vector, active leitmotif, transition plan
 *
 * Constitutional compliance:
 *   Law 1 — Fully deterministic. Same seed + same state sequence = same output.
 *   Law 2 — Emotional continuity via smoothing + harmonic transitions.
 *   Law 3 — CPU-light. No DSP here; this is the control layer.
 *   Law 4 — Full state serializable via getSessionState() / restore().
 */

import type {
  EmotionalStateVector,
  GameStateSnapshot,
  LeitmotifSeed,
  LeitmotifCluster,
  TransitionPlan,
  ERKSessionState,
} from './types';
import { EmotionalStateReceptor } from './receptor';
import { HarmonicTransitionEngine } from './transitions';
import { getLeitmotifsByCluster } from './leitmotifs';
import { DeterministicPRNG } from '../utils/prng';

// Re-export types for consumers
export type {
  EmotionalStateVector,
  GameStateSnapshot,
  LeitmotifSeed,
  LeitmotifCluster,
  TransitionPlan,
  ERKSessionState,
} from './types';
export { EmotionalStateReceptor } from './receptor';
export { HarmonicTransitionEngine, classifyDistance } from './transitions';
export { LEITMOTIF_REGISTRY, getLeitmotifById, getLeitmotifsByCluster, getAllClusters } from './leitmotifs';

// ── ERK Update Result ─────────────────────────────────────────────────────────

export interface ERKUpdateResult {
  /** Current smoothed emotional state. */
  emotional: EmotionalStateVector;
  /** Active leitmotif seed. */
  leitmotif: LeitmotifSeed;
  /** Active cluster. */
  cluster: LeitmotifCluster;
  /** Transition plan if a cluster change occurred this update, else null. */
  transition: TransitionPlan | null;
  /** Whether the cluster changed since last update. */
  clusterChanged: boolean;
  /** Current effective BPM (after mutation envelope). */
  effectiveBpm: number;
  /** Current effective key (after transposition). */
  effectiveKey: number;
}

// ── Main ERK Class ────────────────────────────────────────────────────────────

/**
 * The Emotional Runtime Kernel. Instantiate once per game session.
 *
 * @param seed - Session seed for deterministic PRNG. Must be consistent
 *               across all clients in multiplayer (Law 1).
 */
export class ERK {
  private prng: DeterministicPRNG;
  private receptor: EmotionalStateReceptor;
  private transitionEngine: HarmonicTransitionEngine;

  private activeCluster: LeitmotifCluster = 'narrative';
  private activeLeitmotif: LeitmotifSeed;
  private pendingTransition: TransitionPlan | null = null;
  private currentBpm: number;
  private currentKey: number;

  constructor(seed: string | number) {
    this.prng = new DeterministicPRNG(seed);
    this.receptor = new EmotionalStateReceptor();
    this.transitionEngine = new HarmonicTransitionEngine();

    // Initialize with the first narrative leitmotif (Prologue)
    const narrativeSeeds = getLeitmotifsByCluster('narrative');
    this.activeLeitmotif = narrativeSeeds[0]; // Prologue
    this.currentBpm = this.activeLeitmotif.referenceBpm;
    this.currentKey = this.activeLeitmotif.rootKey;
  }

  /**
   * Process a game state snapshot and return the current ERK state.
   * Call this each frame or on significant game state changes.
   */
  update(snapshot: GameStateSnapshot): ERKUpdateResult {
    // 1. Process emotional state
    const emotional = this.receptor.process(snapshot);

    // 2. Determine target cluster from emotional state
    const targetCluster = this.transitionEngine.selectCluster(emotional);
    let clusterChanged = false;
    let transition: TransitionPlan | null = null;

    // 3. If cluster changed, compute transition and select new leitmotif
    if (targetCluster !== this.activeCluster) {
      const targetLeitmotif = this.transitionEngine.selectLeitmotif(
        targetCluster,
        emotional,
        this.prng,
      );

      transition = this.transitionEngine.computeTransition(
        this.activeCluster,
        targetCluster,
        this.activeLeitmotif,
        targetLeitmotif,
        this.prng,
      );

      this.activeCluster = targetCluster;
      this.activeLeitmotif = targetLeitmotif;
      this.pendingTransition = transition;
      clusterChanged = true;
    }

    // 4. Compute effective BPM and key within mutation bounds
    const effectiveBpm = this.computeEffectiveBpm(emotional);
    const effectiveKey = this.computeEffectiveKey(emotional);
    this.currentBpm = effectiveBpm;
    this.currentKey = effectiveKey;

    return {
      emotional,
      leitmotif: this.activeLeitmotif,
      cluster: this.activeCluster,
      transition,
      clusterChanged,
      effectiveBpm,
      effectiveKey,
    };
  }

  /**
   * Get the full serializable session state for IndexedDB persistence.
   */
  getSessionState(): ERKSessionState {
    return {
      timestamp: Date.now(),
      emotionalState: this.receptor.getCurrent(),
      activeLeitmotifId: this.activeLeitmotif.id,
      activeCluster: this.activeCluster,
      currentBpm: this.currentBpm,
      currentKey: this.currentKey,
      prngState: this.prng.getState(),
      emotionalHistory: this.receptor.getHistory(),
      pendingTransition: this.pendingTransition,
    };
  }

  /**
   * Restore from a persisted session state.
   */
  restore(state: ERKSessionState): void {
    this.prng = new DeterministicPRNG(state.prngState);
    this.receptor.restore(state.emotionalHistory, state.emotionalState);
    this.activeCluster = state.activeCluster;
    this.currentBpm = state.currentBpm;
    this.currentKey = state.currentKey;
    this.pendingTransition = state.pendingTransition;

    // Re-resolve the active leitmotif from registry
    const clusterSeeds = getLeitmotifsByCluster(state.activeCluster);
    this.activeLeitmotif = clusterSeeds.find(s => s.id === state.activeLeitmotifId) ?? clusterSeeds[0];
  }

  /**
   * Reset ERK to initial state.
   */
  reset(seed?: string | number): void {
    if (seed !== undefined) {
      this.prng = new DeterministicPRNG(seed);
    }
    this.receptor.reset();
    this.activeCluster = 'narrative';
    const narrativeSeeds = getLeitmotifsByCluster('narrative');
    this.activeLeitmotif = narrativeSeeds[0];
    this.currentBpm = this.activeLeitmotif.referenceBpm;
    this.currentKey = this.activeLeitmotif.rootKey;
    this.pendingTransition = null;
  }

  // ── Private: Bounded Mutations ──────────────────────────────────────────────

  /**
   * Compute effective BPM within the leitmotif's mutation envelope.
   * High tension + momentum push BPM upward; high resolution pulls downward.
   */
  private computeEffectiveBpm(e: EmotionalStateVector): number {
    const base = this.activeLeitmotif.referenceBpm;
    const maxDrift = this.activeLeitmotif.mutationEnvelope.maxTempoDrift;

    // Intensity factor: combined tension + momentum + chaos
    const intensity = (e.tension * 0.4 + e.momentum * 0.35 + e.chaos * 0.25);
    // Resolution pulls tempo down
    const resolutionDrag = e.resolution * 0.3;

    // Net drift: -1 to +1 range, clamped by envelope
    const driftFactor = Math.max(-1, Math.min(1, (intensity - 0.5) * 2 - resolutionDrag));
    const drift = driftFactor * maxDrift;

    return Math.round(base * (1 + drift));
  }

  /**
   * Compute effective key (root + transposition) within mutation bounds.
   * Transposition is driven by chaos level and PRNG for deterministic variation.
   */
  private computeEffectiveKey(e: EmotionalStateVector): number {
    const base = this.activeLeitmotif.rootKey;
    const maxTranspose = this.activeLeitmotif.mutationEnvelope.maxTransposition;

    // Only transpose when chaos is significant (avoid key drift in calm moments)
    if (e.chaos < 0.4) return base;

    // Deterministic transposition based on chaos level
    // Uses floor to stay within integer semitones
    const transposeMagnitude = Math.floor(e.chaos * maxTranspose);
    // Direction: PRNG determines up or down (but same chaos = same direction)
    const direction = this.prng.next() > 0.5 ? 1 : -1;

    return ((base + direction * transposeMagnitude) + 12) % 12;
  }
}
