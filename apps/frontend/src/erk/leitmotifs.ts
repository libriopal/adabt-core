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
  {
    id: 'october_moon_dark_metal_instrumental_music_no_a_i',
    name: 'October Moon | Dark Metal Instrumental Music',
    cluster: 'profane',
    rootKey: 0,  // C
    mode: 'phrygian',
    referenceBpm: 161,
    harmonicProgression: [1, -2, 1, -7, 1, -2, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'the_heavy_metal_orchestra_arabian_mornings_symphonic_metal_p',
    name: 'The Heavy Metal Orchestra – "Arabian Mornings" (Symphonic Metal)',
    cluster: 'profane',
    rootKey: 10,  // Bb
    mode: 'phrygian',
    referenceBpm: 161,
    harmonicProgression: [1, -2, 1, -7, 1, -2, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'heavy_metal_orchestra_intermission_by_after_the_overture',
    name: 'Heavy Metal Orchestra – "Intermission" by After the Overture',
    cluster: 'profane',
    rootKey: 3,  // Eb
    mode: 'phrygian',
    referenceBpm: 161,
    harmonicProgression: [1, -2, 1, -7, 1, -2, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'the_heavy_metal_orchestra_notes_from_a_pirate_symphonic_meta',
    name: 'The Heavy Metal Orchestra – Notes From a Pirate (Symphonic Metal)',
    cluster: 'profane',
    rootKey: 3,  // Eb
    mode: 'phrygian',
    referenceBpm: 161,
    harmonicProgression: [1, -2, 1, -7, 1, -2, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'arabian_mornings_the_heavy_metal_orchestra_symphonic_metal',
    name: '"Arabian Mornings" – The Heavy Metal Orchestra (Symphonic Metal)',
    cluster: 'profane',
    rootKey: 10,  // Bb
    mode: 'phrygian',
    referenceBpm: 161,
    harmonicProgression: [1, -2, 1, -7, 1, -2, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
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

  // ── Additional Sacred entries (ERK training corpus) ───────────────────────

  {
    id: 'breaking_benjamin_the_diary_of_jane_custom_instrumental',
    name: 'Breaking Benjamin - The Diary Of Jane [Custom Instrumental]',
    cluster: 'sacred',
    rootKey: 7,  // G
    mode: 'major',
    referenceBpm: 83,
    harmonicProgression: [1, 4, 5, 1, 6, 4, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_you_custom_instrumental',
    name: 'Breaking Benjamin - You [Custom Instrumental]',
    cluster: 'sacred',
    rootKey: 0,  // C
    mode: 'lydian',
    referenceBpm: 78,
    harmonicProgression: [1, 4, 5, 1, 6, 4, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'free_ghostemane_x_dark_trap_type_beat_lighter_prod_ayo_sam',
    name: '(FREE) GHOSTEMANE X DARK TRAP TYPE BEAT - LIGHTER [PROD. AYO SAM]',
    cluster: 'sacred',
    rootKey: 10,  // Bb
    mode: 'major',
    referenceBpm: 83,
    harmonicProgression: [1, 4, 5, 1, 6, 4, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_until_the_end_custom_instrumental',
    name: 'Breaking Benjamin - Until The End [Custom Instrumental]',
    cluster: 'sacred',
    rootKey: 4,  // E
    mode: 'lydian',
    referenceBpm: 66,
    harmonicProgression: [1, 4, 5, 1, 6, 4, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },

  // ── Additional Baroque entries (ERK training corpus) ──────────────────────

  {
    id: 'lil_peep_life_is_beautiful_instrumental_fl_studio_flp_benvin',
    name: 'Lil Peep - Life Is Beautiful (Instrumental)',
    cluster: 'baroque',
    rootKey: 0,  // C
    mode: 'major',
    referenceBpm: 89,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'free_lil_peep_type_beat_the_eyes_of_horror',
    name: 'Lil Peep Type Beat "The Eyes of Horror"',
    cluster: 'baroque',
    rootKey: 10,  // Bb
    mode: 'mixolydian',
    referenceBpm: 117,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'free_trap_type_beat_prime_freestyle_beat_2026_melodic_type_b',
    name: 'Trap Type Beat "PRIME" | Freestyle Beat 2026 | Melodic Dark',
    cluster: 'baroque',
    rootKey: 7,  // G
    mode: 'major',
    referenceBpm: 99,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_evil_angel_custom_instrumental',
    name: 'Breaking Benjamin - Evil Angel [Custom Instrumental]',
    cluster: 'baroque',
    rootKey: 9,  // A
    mode: 'mixolydian',
    referenceBpm: 115,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_dance_with_the_devil_custom_instrumental',
    name: 'Breaking Benjamin - Dance With The Devil [Custom Instrumental]',
    cluster: 'baroque',
    rootKey: 6,  // F#
    mode: 'major',
    referenceBpm: 103,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'free_ascend_dark_boom_bap_type_beat_underground_freestyle_ra',
    name: '"ASCEND" - Dark Boom Bap Type Beat | Underground Freestyle Rap Beat 2026',
    cluster: 'baroque',
    rootKey: 4,  // E
    mode: 'major',
    referenceBpm: 92,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_you_fight_me_custom_instrumental',
    name: 'Breaking Benjamin - You Fight Me [Custom Instrumental]',
    cluster: 'baroque',
    rootKey: 0,  // C
    mode: 'major',
    referenceBpm: 96,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'hellward_bound_dark_metal_instrumental_music_no_a_i',
    name: 'Hellward Bound | Dark Metal Instrumental Music',
    cluster: 'baroque',
    rootKey: 0,  // C
    mode: 'major',
    referenceBpm: 110,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'metallica_legendary_hits_symphonic_orchestra_instrumentals_n',
    name: 'Metallica Legendary Hits | Symphonic Orchestra Instrumentals',
    cluster: 'baroque',
    rootKey: 8,  // Ab
    mode: 'major',
    referenceBpm: 108,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'symphonic_metal_mix_vol_1_instrumental',
    name: 'Symphonic Metal Mix Vol.1 (Instrumental)',
    cluster: 'baroque',
    rootKey: 7,  // G
    mode: 'mixolydian',
    referenceBpm: 117,
    harmonicProgression: [1, 5, 6, 3, 4, 1, 5, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },

  // ── Additional Atmospheric entries (ERK training corpus) ─────────────────

  {
    id: 'breaking_benjamin_breath_official_instrumental',
    name: 'Breaking Benjamin - Breath (Official Instrumental)',
    cluster: 'atmospheric',
    rootKey: 0,  // C
    mode: 'aeolian',
    referenceBpm: 62,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'free_memento_mori_dark_boom_bap_type_beat_underground_freest',
    name: '"MEMENTO MORI" - Dark Boom Bap Type Beat | Underground Freestyle Rap Beat 2026',
    cluster: 'atmospheric',
    rootKey: 11,  // B
    mode: 'aeolian',
    referenceBpm: 60,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'free_trap_type_beat_villain_freestyle_beat_2026_melodic_type',
    name: 'Trap Type Beat "VILLAIN" | Freestyle Beat 2026 | Melodic Dark',
    cluster: 'atmospheric',
    rootKey: 6,  // F#
    mode: 'aeolian',
    referenceBpm: 60,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_here_we_are_custom_instrumental',
    name: 'Breaking Benjamin - Here We Are [Custom Instrumental]',
    cluster: 'atmospheric',
    rootKey: 0,  // C
    mode: 'aeolian',
    referenceBpm: 65,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'cry_cigarettes_after_sex_instrumental',
    name: 'Cry - Cigarettes After Sex (Instrumental)',
    cluster: 'atmospheric',
    rootKey: 6,  // F#
    mode: 'aeolian',
    referenceBpm: 72,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'synthetic_flesh_dark_metal_instrumental_music_no_a_i',
    name: 'Synthetic Flesh | Dark Metal Instrumental Music',
    cluster: 'atmospheric',
    rootKey: 0,  // C
    mode: 'aeolian',
    referenceBpm: 60,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'nightcrawler_dark_metal_instrumental_music_no_a_i',
    name: 'NightCrawler | Dark Metal Instrumental Music',
    cluster: 'atmospheric',
    rootKey: 9,  // A
    mode: 'aeolian',
    referenceBpm: 60,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'antarctica_dark_metal_instrumental_music_no_a_i',
    name: 'Antarctica | Dark Metal Instrumental Music',
    cluster: 'atmospheric',
    rootKey: 0,  // C
    mode: 'aeolian',
    referenceBpm: 70,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'the_final_dawn_the_heavy_metal_orchestra_symphonic_metal',
    name: '"The Final Dawn" - The Heavy Metal Orchestra (Symphonic Metal)',
    cluster: 'atmospheric',
    rootKey: 10,  // Bb
    mode: 'aeolian',
    referenceBpm: 68,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'unbound_playthrough_after_the_overture',
    name: '"Unbound" Playthrough - After the Overture',
    cluster: 'atmospheric',
    rootKey: 8,  // Ab
    mode: 'aeolian',
    referenceBpm: 60,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'we_three_kings_the_heavy_metal_orchestra_heavy_metal_christm',
    name: '"We Three Kings" - The Heavy Metal Orchestra',
    cluster: 'atmospheric',
    rootKey: 10,  // Bb
    mode: 'aeolian',
    referenceBpm: 65,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'nu_metalcore_playlist_get_boost_of_adrenaline_and_regain_vit',
    name: 'Nu-Metalcore Playlist | For WorkOut & Gaming',
    cluster: 'atmospheric',
    rootKey: 8,  // Ab
    mode: 'aeolian',
    referenceBpm: 72,
    harmonicProgression: [1, 4, 1, -7, 1, 4, -3, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },

  // ── Additional Narrative entries (ERK training corpus) ────────────────────

  {
    id: 'intro',
    name: 'Intro',
    cluster: 'narrative',
    rootKey: 7,  // G
    mode: 'aeolian',
    referenceBpm: 99,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'meshuggah_spasm_instrumental_cover',
    name: 'MESHUGGAH - Spasm (Instrumental Cover)',
    cluster: 'narrative',
    rootKey: 0,  // C
    mode: 'aeolian',
    referenceBpm: 94,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_topless_custom_instrumental',
    name: 'Breaking Benjamin - Topless [Custom Instrumental]',
    cluster: 'narrative',
    rootKey: 2,  // D
    mode: 'aeolian',
    referenceBpm: 117,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_unknown_soldier_custom_instrumental',
    name: 'Breaking Benjamin - Unknown Soldier [Custom Instrumental]',
    cluster: 'narrative',
    rootKey: 9,  // A
    mode: 'mixolydian',
    referenceBpm: 161,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'free_for_profit_r_b_x_boom_bap_type_beat_night_love',
    name: 'R&B X Boom Bap Type Beat - "Night Love"',
    cluster: 'narrative',
    rootKey: 3,  // Eb
    mode: 'aeolian',
    referenceBpm: 108,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_had_enough_custom_instrumental',
    name: 'Breaking Benjamin - Had Enough [Custom Instrumental]',
    cluster: 'narrative',
    rootKey: 0,  // C
    mode: 'aeolian',
    referenceBpm: 108,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'free_juice_wrld_x_lil_peep_type_beat_dead_romance',
    name: 'Juice WRLD x Lil Peep Type Beat - "Dead Romance"',
    cluster: 'narrative',
    rootKey: 3,  // Eb
    mode: 'aeolian',
    referenceBpm: 86,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'outro',
    name: 'Outro',
    cluster: 'narrative',
    rootKey: 7,  // G
    mode: 'aeolian',
    referenceBpm: 83,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'breaking_benjamin_the_diary_of_jane_instrumental',
    name: 'Breaking Benjamin - The Diary of Jane (Instrumental)',
    cluster: 'narrative',
    rootKey: 2,  // D
    mode: 'aeolian',
    referenceBpm: 83,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'dark_symphonic_metal_orchestral_metal_no_vocals_symphonic_me',
    name: 'Dark Symphonic Metal × Orchestral Metal (No Vocals) | Symphonic Metal Focus Mix',
    cluster: 'narrative',
    rootKey: 1,  // C#
    mode: 'aeolian',
    referenceBpm: 81,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'backing_track_in_e_minor_modern_progressive_metal',
    name: 'Backing Track in E Minor Modern Progressive Metal',
    cluster: 'narrative',
    rootKey: 8,  // Ab
    mode: 'aeolian',
    referenceBpm: 81,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'instrumental_symphonic_death_metal_a_symphony_of_destruction',
    name: 'Instrumental Symphonic Death Metal: A Symphony of Destruction',
    cluster: 'narrative',
    rootKey: 3,  // Eb
    mode: 'aeolian',
    referenceBpm: 99,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'stranger_things_intro_theme_the_heavy_metal_orchestra',
    name: 'Stranger Things Intro Theme | The Heavy Metal Orchestra',
    cluster: 'narrative',
    rootKey: 8,  // Ab
    mode: 'aeolian',
    referenceBpm: 83,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'the_heavy_metal_orchestra_void_of_sanity_with_guitar_symphon',
    name: 'The Heavy Metal Orchestra - "Void of Sanity" (with Guitar)',
    cluster: 'narrative',
    rootKey: 10,  // Bb
    mode: 'aeolian',
    referenceBpm: 99,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'ill_be_bach_the_heavy_metal_orchestra_symphonic_metal',
    name: '"I\'ll Be Bach" - The Heavy Metal Orchestra (Symphonic Metal)',
    cluster: 'narrative',
    rootKey: 8,  // Ab
    mode: 'aeolian',
    referenceBpm: 83,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'mystery_door_3_the_heavy_metal_orchestra_symphonic_metal',
    name: '"Mystery Door #3" - The Heavy Metal Orchestra (Symphonic Metal)',
    cluster: 'narrative',
    rootKey: 1,  // C#
    mode: 'aeolian',
    referenceBpm: 112,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'symphony_no_the_heavy_metal_orchestra_symphonic_metal',
    name: '"Symphony No. ¾" - The Heavy Metal Orchestra (Symphonic Metal)',
    cluster: 'narrative',
    rootKey: 3,  // Eb
    mode: 'mixolydian',
    referenceBpm: 144,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'take_your_seat_by_after_the_overture',
    name: '"Take Your Seat" by After the Overture',
    cluster: 'narrative',
    rootKey: 10,  // Bb
    mode: 'aeolian',
    referenceBpm: 99,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'void_of_sanity_the_heavy_metal_orchestra_symphonic_metal',
    name: '"Void of Sanity" - The Heavy Metal Orchestra (Symphonic Metal)',
    cluster: 'narrative',
    rootKey: 5,  // F
    mode: 'aeolian',
    referenceBpm: 99,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
  },
  {
    id: 'where_i_run_playthrough_after_the_overture',
    name: '"Where I Run" Playthrough - After the Overture',
    cluster: 'narrative',
    rootKey: 10,  // Bb
    mode: 'aeolian',
    referenceBpm: 89,
    harmonicProgression: [1, -3, 4, 5, 1, -6, -7, 1],
    mutationEnvelope: WIDE_ENVELOPE,
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
