// ─────────────────────────────────────────────────────
// Neural Conductor — Spectral Genome
//
// Runtime consumer for extracted spectral genome JSON.
// Source MP3s (Music-intelligence-engine/Training_data/)
// are NEVER decoded at runtime. Features are extracted
// offline (see scripts/extractGenome.ts — NOT YET RUN)
// and stored as compact JSON in public/spectral-genome/*.json.
// Baseline genome JSONs (from manual FAR_NZY training analysis) are now
// served from public/spectral-genome/ — no fallback fetch needed in prod.
// Replace with real extraction output when MP3s are available.
//
// Each genome file maps to one of the 8 ERK emotional states:
//   Dread, Suspense, Escalation, CatastrophicRelease,
//   Mourning, Recovery, Silence, RitualisticBuild
//
// The genome JSON schema:
// {
//   "state": "Dread",
//   "bpm": 140,
//   "spectralCentroid": 420,
//   "harmonicTension": 0.85,
//   "dissonance": 0.72,
//   "motifIntervals": [0, 3, 7, 12],   // semitones
//   "onsetDensity": 0.6,
//   "chromaProfile": [0.1, 0.05, ...], // 12 chroma bins
//   "fftBands": [0.8, 0.6, 0.3, 0.1],  // sub/low/mid/high energy
//   "transitionCurve": "exponential"
// }
// ─────────────────────────────────────────────────────

export type ERKState =
  | 'Dread' | 'Suspense' | 'Escalation' | 'CatastrophicRelease'
  | 'Mourning' | 'Recovery' | 'Silence' | 'RitualisticBuild';

export interface SpectralGenome {
  state: ERKState;
  bpm: number;
  spectralCentroid: number;     // Hz
  harmonicTension: number;      // 0–1
  dissonance: number;           // 0–1
  motifIntervals: number[];     // semitone offsets from root
  onsetDensity: number;         // onsets per second (normalized 0–1)
  chromaProfile: number[];      // 12 chroma bins, sum = 1
  fftBands: number[];           // [sub, low, mid, high] energy 0–1
  transitionCurve: 'linear' | 'exponential' | 'sigmoid';
}

// ── Fallback genomes (used until real extraction runs) ────────────────────
// Derived from FAR_NZY training data musical analysis (manual approximation).
const FALLBACK_GENOMES: Record<ERKState, SpectralGenome> = {
  Dread: {
    state: 'Dread', bpm: 60, spectralCentroid: 280, harmonicTension: 0.9,
    dissonance: 0.8, motifIntervals: [0, 1, 6, 11], onsetDensity: 0.2,
    chromaProfile: [0.2, 0.05, 0.05, 0.05, 0.1, 0.05, 0.15, 0.05, 0.1, 0.05, 0.1, 0.05],
    fftBands: [0.9, 0.6, 0.2, 0.05], transitionCurve: 'exponential',
  },
  Suspense: {
    state: 'Suspense', bpm: 80, spectralCentroid: 400, harmonicTension: 0.7,
    dissonance: 0.6, motifIntervals: [0, 2, 7, 10], onsetDensity: 0.4,
    chromaProfile: [0.15, 0.05, 0.1, 0.05, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.1, 0.05],
    fftBands: [0.6, 0.5, 0.3, 0.1], transitionCurve: 'sigmoid',
  },
  Escalation: {
    state: 'Escalation', bpm: 140, spectralCentroid: 800, harmonicTension: 0.6,
    dissonance: 0.4, motifIntervals: [0, 4, 7, 11], onsetDensity: 0.8,
    chromaProfile: [0.15, 0.05, 0.1, 0.05, 0.15, 0.05, 0.1, 0.1, 0.05, 0.1, 0.05, 0.05],
    fftBands: [0.5, 0.7, 0.6, 0.4], transitionCurve: 'linear',
  },
  CatastrophicRelease: {
    state: 'CatastrophicRelease', bpm: 180, spectralCentroid: 1400, harmonicTension: 0.3,
    dissonance: 0.2, motifIntervals: [0, 5, 7, 12], onsetDensity: 1.0,
    chromaProfile: [0.2, 0.05, 0.1, 0.05, 0.15, 0.05, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05],
    fftBands: [0.4, 0.6, 0.9, 0.8], transitionCurve: 'linear',
  },
  Mourning: {
    state: 'Mourning', bpm: 50, spectralCentroid: 350, harmonicTension: 0.75,
    dissonance: 0.5, motifIntervals: [0, 3, 5, 9], onsetDensity: 0.15,
    chromaProfile: [0.1, 0.05, 0.1, 0.1, 0.05, 0.1, 0.05, 0.1, 0.1, 0.1, 0.1, 0.05],
    fftBands: [0.4, 0.3, 0.3, 0.1], transitionCurve: 'sigmoid',
  },
  Recovery: {
    state: 'Recovery', bpm: 90, spectralCentroid: 600, harmonicTension: 0.4,
    dissonance: 0.25, motifIntervals: [0, 4, 7, 9], onsetDensity: 0.5,
    chromaProfile: [0.12, 0.05, 0.1, 0.05, 0.12, 0.1, 0.08, 0.12, 0.05, 0.1, 0.06, 0.05],
    fftBands: [0.3, 0.4, 0.5, 0.3], transitionCurve: 'linear',
  },
  Silence: {
    state: 'Silence', bpm: 40, spectralCentroid: 150, harmonicTension: 0.1,
    dissonance: 0.05, motifIntervals: [0], onsetDensity: 0.02,
    chromaProfile: [0.15, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.07],
    fftBands: [0.05, 0.03, 0.02, 0.01], transitionCurve: 'exponential',
  },
  RitualisticBuild: {
    state: 'RitualisticBuild', bpm: 120, spectralCentroid: 700, harmonicTension: 0.55,
    dissonance: 0.35, motifIntervals: [0, 2, 5, 7, 10], onsetDensity: 0.65,
    chromaProfile: [0.14, 0.06, 0.09, 0.06, 0.12, 0.08, 0.1, 0.1, 0.06, 0.09, 0.05, 0.05],
    fftBands: [0.5, 0.55, 0.6, 0.45], transitionCurve: 'sigmoid',
  },
};

// ── Runtime genome loader ─────────────────────────────────────────────────

const _cache = new Map<ERKState, SpectralGenome>();

export async function loadGenome(state: ERKState): Promise<SpectralGenome> {
  if (_cache.has(state)) return _cache.get(state)!;

  try {
    const res = await fetch(`/spectral-genome/${state}.json`);
    if (!res.ok) throw new Error('not found');
    const genome = await res.json() as SpectralGenome;
    _cache.set(state, genome);
    return genome;
  } catch {
    // Fall back to manual approximation until extraction pipeline runs
    const fallback = FALLBACK_GENOMES[state];
    _cache.set(state, fallback);
    return fallback;
  }
}

// ── Genome → DreamAudioEngine parameter mapping ───────────────────────────

export interface GenomeAudioParams {
  bpm: number;
  filterCutoff: number;    // Hz — mapped from spectralCentroid
  gainMultiplier: number;  // mapped from onsetDensity
  reverbWet: number;       // mapped from dissonance
  lfoRate: number;         // mapped from harmonicTension
}

export function genomeToAudioParams(genome: SpectralGenome): GenomeAudioParams {
  return {
    bpm: genome.bpm,
    filterCutoff: Math.max(80, genome.spectralCentroid * 2),
    gainMultiplier: 0.5 + genome.onsetDensity * 0.8,
    reverbWet: genome.dissonance * 0.6,
    lfoRate: genome.harmonicTension * 4 + 0.5,
  };
}
