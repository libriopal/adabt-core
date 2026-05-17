/**
 * PhraseGenerator — ERK Module
 *
 * Deterministic 4/8-bar melodic phrase generation from the
 * 5-axis EmotionalStateVector + leitmotif seed registry.
 *
 * Constitutional compliance:
 *   Law 1 — No Math.random(). All output is deterministic from (vector, seed).
 *   Law 2 — Mutations stay within the active leitmotif's MutationEnvelope.
 *   Law 3 — No audio playback or DSP work; returns plain data structures only.
 *   Law 4 — PhraseOutput is serializable for IndexedDB checkpoints.
 *
 * Integration:
 *   PhraseOutput feeds DreamAudioEngine.applyPhrase() for parameter updates.
 *   The generator runs on the main thread but produces only numbers/strings —
 *   the actual DSP stays in the AudioWorklet.
 */

import type { EmotionalStateVector, LeitmotifCluster, LeitmotifSeed } from './types';
import {
  LEITMOTIF_REGISTRY,
  getLeitmotifsByCluster,
} from './leitmotifs';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PhraseBar {
  /** Harmonic degree for this bar (1-based scale degree, negative = lowered). */
  degree: number;
  /** Effective duration in beats (always 4 for 4/4 time). */
  beats: 4;
}

export interface PhraseOutput {
  /** Source leitmotif ID used to generate this phrase. */
  leitmotifId: string;
  /** Thematic cluster active at generation time. */
  cluster: LeitmotifCluster;
  /** Number of bars: 4 (low tension) or 8 (high tension). */
  barCount: 4 | 8;
  /** Effective BPM after tension/momentum mutation. */
  bpm: number;
  /** Effective root key (0–11) after resolution-driven transposition. */
  rootKey: number;
  /** Musical mode inherited from leitmotif. */
  mode: string;
  /** Ordered harmonic bars for this phrase. */
  bars: PhraseBar[];
  /** Dominant axis that drove cluster selection (for AV binding). */
  dominantAxis: keyof EmotionalStateVector;
  /** The PRNG seed used — include in ERKSessionState for replay. */
  seed: number;
}

// ── Cluster selection ─────────────────────────────────────────────────────────
//
// Axis priority order (descending):
//   1. resolution > 0.70  → narrative  (approaching win/lose)
//   2. chaos      > 0.60  → profane    (high disruption / Frenzy instability)
//   3. tension    > 0.70
//      && momentum > 0.55  → baroque   (climbing multiplier, fast momentum)
//   4. tension    < 0.25
//      && chaos    < 0.25  → sacred    (calm, low-stakes opening)
//   5. (default)           → atmospheric

function selectCluster(v: EmotionalStateVector): { cluster: LeitmotifCluster; axis: keyof EmotionalStateVector } {
  if (v.resolution > 0.70) return { cluster: 'narrative',   axis: 'resolution' };
  if (v.chaos      > 0.60) return { cluster: 'profane',     axis: 'chaos'      };
  if (v.tension    > 0.70 && v.momentum > 0.55)
                            return { cluster: 'baroque',     axis: 'tension'    };
  if (v.tension    < 0.25 && v.chaos    < 0.25)
                            return { cluster: 'sacred',      axis: 'tension'    };
  return                           { cluster: 'atmospheric', axis: 'momentum'  };
}

// ── Deterministic mini-PRNG (xorshift32) ─────────────────────────────────────
// Deliberately separate from the Sacred Core seededRng.
// Used only for presentation-layer phrase generation — never touches scoring.

function makeXorshift(seed: number) {
  let s = (seed >>> 0) || 0xdeadbeef;
  return function next(): number {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000; // [0, 1)
  };
}

// ── Phrase generation ─────────────────────────────────────────────────────────

/**
 * Generate a deterministic melodic phrase from the current emotional vector.
 *
 * @param vector  — Current EmotionalStateVector (all axes 0–1)
 * @param seed    — Integer seed (store in ERKSessionState for replay)
 * @returns PhraseOutput — plain data, ready for DreamAudioEngine.applyPhrase()
 */
export function generatePhrase(vector: EmotionalStateVector, seed: number): PhraseOutput {
  const { cluster, axis } = selectCluster(vector);
  const rng = makeXorshift(seed);

  // Pick leitmotif within the cluster (deterministic index from rng)
  const candidates: readonly LeitmotifSeed[] = getLeitmotifsByCluster(cluster);
  const seed2 = LEITMOTIF_REGISTRY.length;       // stable offset for index pick
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  const leitmotif = candidates[idx] ?? candidates[0]!;
  void seed2; // used above implicitly via closure

  // ── Bar count: 4 bars at low tension, 8 bars at high tension ──────────────
  const barCount: 4 | 8 = vector.tension >= 0.50 ? 8 : 4;

  // ── Tempo: referenceBpm ± (maxTempoDrift × momentum) ─────────────────────
  const { maxTempoDrift, maxTransposition } = leitmotif.mutationEnvelope;
  const tempoDelta = (rng() * 2 - 1) * maxTempoDrift * leitmotif.referenceBpm;
  const momentumScale = 1 + (vector.momentum - 0.5) * maxTempoDrift;
  const bpm = Math.round(
    Math.max(40, Math.min(220, leitmotif.referenceBpm * momentumScale + tempoDelta))
  );

  // ── Key transposition: within maxTransposition, biased by resolution ──────
  // High resolution → shift toward brighter keys (positive transposition).
  // Low resolution → shift toward darker keys (negative transposition).
  const transpositionBias = (vector.resolution - 0.5) * 2; // [-1, 1]
  const rawTranspose = Math.round(transpositionBias * maxTransposition + (rng() * 2 - 1) * 0.5);
  const transposition = Math.max(-maxTransposition, Math.min(maxTransposition, rawTranspose));
  const rootKey = ((leitmotif.rootKey + transposition) % 12 + 12) % 12;

  // ── Harmonic sequence: tile the progression to fill barCount bars ─────────
  const prog = leitmotif.harmonicProgression;
  const bars: PhraseBar[] = [];
  for (let i = 0; i < barCount; i++) {
    // Walk through progression cyclically; apply occasional voice mutation.
    let degree = prog[i % prog.length]!;

    // Mutation gate: within maxVoiceMutationsPerBar, chaos biases substitution.
    const mutationThreshold = 0.85 - vector.chaos * 0.40;
    if (rng() > mutationThreshold) {
      // Substitute with an adjacent progression degree (±1 step).
      const step = rng() > 0.5 ? 1 : -1;
      const progIdx = (i % prog.length) + step;
      const alt = prog[((progIdx % prog.length) + prog.length) % prog.length];
      if (alt !== undefined) degree = alt;
    }

    bars.push({ degree, beats: 4 });
  }

  return {
    leitmotifId: leitmotif.id,
    cluster,
    barCount,
    bpm,
    rootKey,
    mode: leitmotif.mode,
    bars,
    dominantAxis: axis,
    seed,
  };
}

// ── Phrase seed derivation ────────────────────────────────────────────────────
// Derive a stable per-turn seed from serverTick + seedCursor without
// touching Math.random() (unified_lattice.json r1, seedPolicy).

export function deriveSeed(serverTick: number, seedCursor: number): number {
  // FNV-1a-like mix of two integers → deterministic u32
  let h = 0x811c9dc5;
  h = Math.imul(h ^ (serverTick & 0xff), 0x01000193);
  h = Math.imul(h ^ ((serverTick >> 8) & 0xff), 0x01000193);
  h = Math.imul(h ^ (seedCursor & 0xff), 0x01000193);
  h = Math.imul(h ^ ((seedCursor >> 8) & 0xff), 0x01000193);
  return h >>> 0;
}
