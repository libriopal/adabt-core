/**
 * Harmonic Transition Engine — ERK Module
 *
 * Computes deterministic transition plans between leitmotif clusters.
 * Transition strategy varies by cluster distance:
 *   - Same cluster:    Direct continuation (0 bridge bars)
 *   - Adjacent cluster: 2-bar bridge via shared harmonic degree (pivot chord)
 *   - Distant cluster:  4-bar bridge via secondary dominant chain
 *
 * Constitutional compliance:
 *   Law 1 — All transitions seeded from DeterministicPRNG. Same state = same path.
 *   Law 2 — No hard-cuts between clusters. All cross-cluster transitions use
 *           harmonic modulation to preserve emotional continuity.
 *   Law 3 — Computation is O(1) per transition; no allocation pressure.
 *   Law 4 — TransitionPlan is serializable.
 */

import type {
  LeitmotifCluster,
  ClusterDistance,
  TransitionPlan,
  EmotionalStateVector,
  LeitmotifSeed,
} from './types';
import { DeterministicPRNG } from '../utils/prng';
import { getLeitmotifsByCluster } from './leitmotifs';

// ── Cluster Adjacency Map ─────────────────────────────────────────────────────

/**
 * Adjacency relationships between leitmotif clusters.
 * Adjacent clusters share harmonic affinity (overlapping modes/keys)
 * and can transition smoothly via a single pivot chord.
 *
 * The topology:
 *   sacred ←→ narrative ←→ baroque ←→ profane
 *                ↕                       ↕
 *           atmospheric ←─────────────→ atmospheric
 *
 * Atmospheric is adjacent to all clusters (liminal = transitional by nature).
 */
const ADJACENCY: Record<LeitmotifCluster, Set<LeitmotifCluster>> = {
  sacred:      new Set(['narrative', 'atmospheric']),
  profane:     new Set(['baroque', 'atmospheric']),
  baroque:     new Set(['narrative', 'profane', 'atmospheric']),
  atmospheric: new Set(['sacred', 'profane', 'baroque', 'narrative']),
  narrative:   new Set(['sacred', 'baroque', 'atmospheric']),
};

/**
 * Shared harmonic degrees between clusters for pivot-chord modulation.
 * Keys are `${from}→${to}`, values are the scale degree that works
 * as a pivot in both clusters' harmonic vocabularies.
 */
const PIVOT_DEGREES: Record<string, number> = {
  'sacred→narrative':    4,  // subdominant (IV) — shared gravitas
  'sacred→atmospheric':  1,  // tonic pedal — meditative continuity
  'narrative→sacred':    5,  // dominant (V) — resolution toward sacred
  'narrative→baroque':   5,  // dominant (V) — energizing transition
  'narrative→atmospheric': 4, // subdominant — descending into atmosphere
  'baroque→narrative':   3,  // mediant (iii) — introspective shift
  'baroque→profane':     5,  // dominant — darkening
  'baroque→atmospheric': 6,  // submediant (vi) — relative minor descent
  'profane→baroque':     1,  // tonic power — assertive shift
  'profane→atmospheric': -7, // flat VII — ominous descent
  'atmospheric→sacred':  4,  // subdominant — ascending toward light
  'atmospheric→profane': -2, // flat II (Neapolitan) — darkening
  'atmospheric→baroque': 5,  // dominant — energizing emergence
  'atmospheric→narrative': 1, // tonic — grounding into story
};

// ── Distance Classification ───────────────────────────────────────────────────

/**
 * Determine the harmonic distance category between two leitmotif clusters.
 *
 * @returns `'same'` if `from` and `to` are the same cluster, `'adjacent'` if they are harmonically adjacent, `'distant'` otherwise.
 */
export function classifyDistance(from: LeitmotifCluster, to: LeitmotifCluster): ClusterDistance {
  if (from === to) return 'same';
  if (ADJACENCY[from].has(to)) return 'adjacent';
  return 'distant';
}

// ── Secondary Dominant Chain Generator ─────────────────────────────────────────

/**
 * Selects a sequence of scale degrees forming a modulation chain from a source root to a target root.
 *
 * @param fromKey - Source root key as an integer 0–11 (semitone index)
 * @param toKey - Target root key as an integer 0–11 (semitone index)
 * @param prng - Seeded PRNG used to preserve deterministic API behavior
 * @returns An array of scale degrees representing the modulation chain that resolves to the target tonic (`1`)
 */
function generateDominantChain(fromKey: number, toKey: number, prng: DeterministicPRNG): number[] {
  // Calculate the interval (in semitones) between the two keys
  const interval = ((toKey - fromKey) + 12) % 12;

  // Base chain: always ends on V→I of the target
  // The intermediate steps create a chromatic bridge
  if (interval <= 6) {
    // Ascending motion: use ascending secondary dominants
    return [5, 2, 5, 1]; // V/V → ii → V → I (of target)
  } else {
    // Descending motion: use descending approach
    return [4, -7, 5, 1]; // IV → bVII → V → I (of target)
  }
}

// ── Transition Engine ─────────────────────────────────────────────────────────

/**
 * The HarmonicTransitionEngine computes deterministic transition plans
 * between leitmotif clusters or individual leitmotifs.
 */
export class HarmonicTransitionEngine {
  /**
   * Compute a transition plan from one cluster to another.
   *
   * @param from - Source cluster
   * @param to - Target cluster
   * @param fromSeed - Source leitmotif (for key/BPM reference)
   * @param toSeed - Target leitmotif (for key/BPM reference)
   * @param prng - Seeded PRNG for deterministic variation
   * @returns A TransitionPlan describing how to modulate between the two
   */
  computeTransition(
    from: LeitmotifCluster,
    to: LeitmotifCluster,
    fromSeed: LeitmotifSeed,
    toSeed: LeitmotifSeed,
    prng: DeterministicPRNG,
  ): TransitionPlan {
    const distance = classifyDistance(from, to);
    const seed = prng.getState();

    switch (distance) {
      case 'same':
        return {
          from,
          to,
          distance: 'same',
          bridgeBars: 0,
          pivotDegree: null,
          dominantChain: [],
          seed,
        };

      case 'adjacent': {
        const key = `${from}→${to}`;
        const pivot = PIVOT_DEGREES[key] ?? 5; // fallback to dominant
        return {
          from,
          to,
          distance: 'adjacent',
          bridgeBars: 2,
          pivotDegree: pivot,
          dominantChain: [],
          seed,
        };
      }

      case 'distant': {
        const chain = generateDominantChain(fromSeed.rootKey, toSeed.rootKey, prng);
        return {
          from,
          to,
          distance: 'distant',
          bridgeBars: 4,
          pivotDegree: null,
          dominantChain: chain,
          seed,
        };
      }
    }
  }

  /**
   * Select the optimal target leitmotif within a cluster based on
   * the current emotional state vector.
   *
   * Selection criteria:
   *   - High tension/chaos → prefer faster BPM, minor modes
   *   - High resolution → prefer slower BPM, major/lydian modes
   *   - High momentum → prefer moderate-fast BPM
   *
   * Selection is deterministic via the PRNG seed.
   *
   * @param cluster - Target cluster to select from
   * @param emotional - Current emotional state
   * @param prng - Seeded PRNG
   * @returns The selected leitmotif seed
   */
  selectLeitmotif(
    cluster: LeitmotifCluster,
    emotional: EmotionalStateVector,
    prng: DeterministicPRNG,
  ): LeitmotifSeed {
    const candidates = getLeitmotifsByCluster(cluster);
    if (candidates.length === 0) {
      throw new Error(`No leitmotifs registered for cluster: ${cluster}`);
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    // Score each candidate against the emotional state
    const scores = candidates.map(c => this.scoreCandidate(c, emotional));

    // Weighted random selection (deterministic via PRNG)
    const totalScore = scores.reduce((a, b) => a + b, 0);
    if (totalScore <= 0) {
      return candidates[prng.nextInt(0, candidates.length - 1)];
    }

    let threshold = prng.next() * totalScore;
    for (let i = 0; i < candidates.length; i++) {
      threshold -= scores[i];
      if (threshold <= 0) return candidates[i];
    }

    return candidates[candidates.length - 1];
  }

  /**
   * Determine which cluster best matches the current emotional state.
   *
   * Mapping logic:
   *   - High chaos + high momentum → profane
   *   - High tension + moderate chaos → baroque
   *   - High resolution (>0.8) → sacred
   *   - Low momentum + low chaos → atmospheric
   *   - Default / balanced → narrative
   */
  selectCluster(emotional: EmotionalStateVector): LeitmotifCluster {
    const { tension, momentum, risk, chaos, resolution } = emotional;

    // Resolution override: approaching game conclusion
    if (resolution > 0.8) return 'sacred';

    // High chaos + momentum = aggressive/demonic
    if (chaos > 0.6 && momentum > 0.6) return 'profane';

    // High tension with moderate activity = ornamental intensity
    if (tension > 0.5 && momentum > 0.3 && chaos < 0.5) return 'baroque';

    // Low energy states = liminal/atmospheric
    if (momentum < 0.3 && chaos < 0.3) return 'atmospheric';

    // Default: narrative arc
    return 'narrative';
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Score a leitmotif candidate against the emotional state.
   * Higher score = better fit.
   */
  private scoreCandidate(seed: LeitmotifSeed, e: EmotionalStateVector): number {
    let score = 1.0; // base score

    // BPM affinity: high tension/chaos prefer faster tempos
    const intensityDemand = (e.tension + e.chaos + e.momentum) / 3;
    const bpmNorm = (seed.referenceBpm - 56) / (160 - 56); // normalize to 0–1
    score += 1.0 - Math.abs(intensityDemand - bpmNorm); // closer = better

    // Mode affinity: minor/phrygian for high chaos, major/lydian for resolution
    if (e.chaos > 0.5 && (seed.mode === 'phrygian' || seed.mode === 'minor' || seed.mode === 'aeolian')) {
      score += 0.5;
    }
    if (e.resolution > 0.6 && (seed.mode === 'major' || seed.mode === 'lydian')) {
      score += 0.5;
    }
    if (e.momentum < 0.3 && (seed.mode === 'dorian' || seed.mode === 'locrian')) {
      score += 0.3;
    }

    return Math.max(score, 0.1); // never zero
  }
}
