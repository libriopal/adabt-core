/**
 * Leitmotif Seed Registry — ERK Module
 *
 * Defines the deterministic seed profiles for all 23 training tracks
 * from the FAR_NZY Music Intelligence Engine corpus (Castlevania: SotN).
 *
 * Each leitmotif has:
 *   - A thematic cluster assignment (A–E)
 *   - A root key and mode
 *   - A reference BPM
 *   - A harmonic progression template (scale degrees)
 *   - A bounded mutation envelope (Law 2 compliance)
 *
 * Constitutional compliance:
 *   Law 1 — All values are deterministic constants. No runtime randomness.
 *   Law 2 — Mutation envelopes enforce thematic identity preservation.
 *   Law 4 — Registry is serializable (plain objects, no functions).
 *
 * NOTE: BPM, key, and mode are educated estimates derived from track names
 * and the Gothic-Baroque-orchestral character of the SotN soundtrack.
 * These should be refined when the Music Engine's BPM/key detection
 * pipeline (Phase 2.5) produces analyzed values for each track.
 */

import type { LeitmotifSeed, LeitmotifCluster, MutationEnvelope } from './types';

// ── Default Mutation Envelopes ────────────────────────────────────────────────

const STANDARD_ENVELOPE: MutationEnvelope = {
  maxTempoDrift: 0.15,
  maxTransposition: 2,
  voicingFamilies: ['strings', 'woodwinds', 'brass', 'keys'],
  maxVoiceMutationsPerBar: 2,
};

const TIGHT_ENVELOPE: MutationEnvelope = {
  maxTempoDrift: 0.10,
  maxTransposition: 1,
  voicingFamilies: ['strings', 'keys'],
  maxVoiceMutationsPerBar: 1,
};

const WIDE_ENVELOPE: MutationEnvelope = {
  maxTempoDrift: 0.15,
  maxTransposition: 2,
  voicingFamilies: ['strings', 'woodwinds', 'brass', 'keys', 'percussion'],
  maxVoiceMutationsPerBar: 3,
};

// ── Leitmotif Registry ────────────────────────────────────────────────────────

/**
 * Complete registry of all 23 leitmotif seeds.
 *
 * Harmonic progressions use scale degrees (1-based):
 *   1 = tonic, 2 = supertonic, ... 7 = leading tone
 *   Negative values indicate minor/diminished variants.
 */
export const LEITMOTIF_REGISTRY: readonly LeitmotifSeed[] = [
  // ── Cluster A: Sacred / Celestial ─────────────────────────────────────────

  {
    id: 'gate_of_holy_spirits',
    name: 'Gate of Holy Spirits',
    cluster: 'sacred',
    rootKey: 0,  // C
    mode: 'lydian',
    referenceBpm: 72,
    harmonicProgression: [1, 4, 5, 1, 6, 4, 5, 1],
    mutationEnvelope: TIGHT_ENVELOPE,
  },
  {
    id: 'gates_of_heaven',
    name: 'Gates of Heaven',
    cluster: 'sacred',
    rootKey: 5,  // F
    mode: 'major',
    referenceBpm: 80,
    harmonicProgression: [1, 5, 6, 4, 1, 5, 4, 1],
    mutationEnvelope: TIGHT_ENVELOPE,
  },
  {
    id: 'land_of_benediction',
    name: 'Land of Benediction (Game Over)',
    cluster: 'sacred',
    rootKey: 7,  // G
    mode: 'major',
    referenceBpm: 66,
    harmonicProgression: [1, 4, 1, 5, 6, 4, 5, 1],
    mutationEnvelope: TIGHT_ENVELOPE,
  },
  {
    id: 'requiem_of_the_gods',
    name: 'Requiem of the Gods',
    cluster: 'sacred',
    rootKey: 3,  // Eb
    mode: 'minor',
    referenceBpm: 60,
    harmonicProgression: [1, 4, 5, 1, -7, 3, 4, 5],
    mutationEnvelope: STANDARD_ENVELOPE,
  },

  // ── Cluster B: Profane / Demonic ──────────────────────────────────────────

  {
    id: 'gates_of_hell',
    name: 'Gates of Hell',
    cluster: 'profane',
    rootKey: 1,  // C#/Db
    mode: 'phrygian',
    referenceBpm: 140,
    harmonicProgression: [1, -2, 1, -7, 1, -2, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'demonic_banquet',
    name: 'Demonic Banquet',
    cluster: 'profane',
    rootKey: 10, // Bb
    mode: 'minor',
    referenceBpm: 160,
    harmonicProgression: [1, 5, -6, 4, 1, -7, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'black_banquet',
    name: 'Black Banquet',
    cluster: 'profane',
    rootKey: 8,  // Ab
    mode: 'phrygian',
    referenceBpm: 148,
    harmonicProgression: [1, -2, -3, -2, 1, 4, -2, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'strange_bloodlines',
    name: 'Strange Bloodlines',
    cluster: 'profane',
    rootKey: 6,  // F#
    mode: 'aeolian',
    referenceBpm: 130,
    harmonicProgression: [1, -7, -6, 5, 1, -3, -7, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },

  // ── Cluster C: Baroque / Dance ────────────────────────────────────────────

  {
    id: 'golden_dance',
    name: 'Golden Dance',
    cluster: 'baroque',
    rootKey: 2,  // D
    mode: 'major',
    referenceBpm: 120,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'waltz_of_the_pearls',
    name: 'Waltz of the Pearls',
    cluster: 'baroque',
    rootKey: 9,  // A
    mode: 'major',
    referenceBpm: 108,
    harmonicProgression: [1, 4, 5, 1, 6, 2, 5, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'crystal_teardrops',
    name: 'Crystal Teardrops',
    cluster: 'baroque',
    rootKey: 4,  // E
    mode: 'minor',
    referenceBpm: 96,
    harmonicProgression: [1, 4, -7, 3, -6, 4, 5, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'wood_carved_partita',
    name: 'Wood-Carved Partita',
    cluster: 'baroque',
    rootKey: 7,  // G
    mode: 'major',
    referenceBpm: 112,
    harmonicProgression: [1, 5, 1, 4, 5, 6, 5, 1],
    mutationEnvelope: TIGHT_ENVELOPE,
  },
  {
    id: 'dance_of_illusions',
    name: 'Dance of Illusions',
    cluster: 'baroque',
    rootKey: 2,  // D
    mode: 'minor',
    referenceBpm: 138,
    harmonicProgression: [1, 5, 1, 4, -7, -6, 5, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },

  // ── Cluster D: Atmospheric / Liminal ──────────────────────────────────────

  {
    id: 'silence',
    name: 'Silence',
    cluster: 'atmospheric',
    rootKey: 0,  // C
    mode: 'dorian',
    referenceBpm: 56,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: TIGHT_ENVELOPE,
  },
  {
    id: 'wandering_ghosts',
    name: 'Wandering Ghosts',
    cluster: 'atmospheric',
    rootKey: 11, // B
    mode: 'aeolian',
    referenceBpm: 68,
    harmonicProgression: [1, -7, -6, -7, 1, -3, 4, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'the_lost_portrait',
    name: 'The Lost Portrait',
    cluster: 'atmospheric',
    rootKey: 5,  // F
    mode: 'minor',
    referenceBpm: 76,
    harmonicProgression: [1, -6, -7, 1, 4, 5, -7, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'tower_of_evil_mist',
    name: 'Tower of Evil Mist',
    cluster: 'atmospheric',
    rootKey: 8,  // Ab
    mode: 'locrian',
    referenceBpm: 64,
    harmonicProgression: [1, -2, -5, -2, 1, -6, -2, 1],
    mutationEnvelope: TIGHT_ENVELOPE,
  },
  {
    id: 'rainbows_cemetery',
    name: "Rainbow's Cemetery",
    cluster: 'atmospheric',
    rootKey: 3,  // Eb
    mode: 'dorian',
    referenceBpm: 72,
    harmonicProgression: [1, 4, -7, 1, -3, 4, -7, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },

  // ── Cluster E: Narrative / Processional ───────────────────────────────────

  {
    id: 'prologue',
    name: 'Prologue',
    cluster: 'narrative',
    rootKey: 0,  // C
    mode: 'minor',
    referenceBpm: 84,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'symphony_of_the_night',
    name: 'Symphony of the Night',
    cluster: 'narrative',
    rootKey: 2,  // D
    mode: 'minor',
    referenceBpm: 92,
    harmonicProgression: [1, 4, 5, 1, -7, -6, 5, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'master_librarian',
    name: 'Master Librarian',
    cluster: 'narrative',
    rootKey: 9,  // A
    mode: 'mixolydian',
    referenceBpm: 100,
    harmonicProgression: [1, -7, 4, 1, 5, -7, 4, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'the_festival_of_servants',
    name: 'The Festival of Servants',
    cluster: 'narrative',
    rootKey: 5,  // F
    mode: 'major',
    referenceBpm: 116,
    harmonicProgression: [1, 4, 5, 3, 6, 4, 5, 1],
    mutationEnvelope: STANDARD_ENVELOPE,
  },
  {
    id: 'the_poetic_ballad_of_death',
    name: 'The Poetic Ballad of Death',
    cluster: 'narrative',
    rootKey: 10, // Bb
    mode: 'aeolian',
    referenceBpm: 70,
    harmonicProgression: [1, -6, -3, -7, 1, 4, 5, 1],
    mutationEnvelope: TIGHT_ENVELOPE,
  },
] as const;

// ── Lookup Helpers ────────────────────────────────────────────────────────────

/** Map of leitmotif ID → LeitmotifSeed for O(1) lookup. */
const _byId = new Map<string, LeitmotifSeed>(
  LEITMOTIF_REGISTRY.map(l => [l.id, l])
);

/** Map of cluster → LeitmotifSeed[] for cluster queries. */
const _byCluster = new Map<LeitmotifCluster, LeitmotifSeed[]>();
for (const seed of LEITMOTIF_REGISTRY) {
  const arr = _byCluster.get(seed.cluster) || [];
  arr.push(seed);
  _byCluster.set(seed.cluster, arr);
}

/**
 * Look up a leitmotif seed by ID.
 */
export function getLeitmotifById(id: string): LeitmotifSeed | undefined {
  return _byId.get(id);
}

/**
 * Get all leitmotif seeds in a given cluster.
 */
export function getLeitmotifsByCluster(cluster: LeitmotifCluster): readonly LeitmotifSeed[] {
  return [...(_byCluster.get(cluster) ?? [])];
}

/**
 * Get all cluster IDs.
 */
export function getAllClusters(): readonly LeitmotifCluster[] {
  return ['sacred', 'profane', 'baroque', 'atmospheric', 'narrative'];
}
