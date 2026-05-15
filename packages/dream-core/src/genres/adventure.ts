// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre #17: ADVENTURE (Hero's Journey Keys)
// 3 chapters per match with musical key changes.
// ─────────────────────────────────────────────────────

import type { HeroJourneyState, ChapterPhase } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────
const CHAPTER_THRESHOLDS = {
  THE_CALL: 0,              // turns 0–9
  THE_ORDEAL: 10,           // turns 10–19
  THE_RETURN: 20,           // turns 20+
};

const MUSICAL_KEYS: Record<ChapterPhase, string> = {
  THE_CALL: 'C_MAJOR',     // bright, innocent
  THE_ORDEAL: 'D_MINOR',   // tense, dark
  THE_RETURN: 'Eb_MAJOR',  // triumphant, elevated
};

const KEY_TRANSITION_DURATION_MS = 2000; // 2 second glide between keys

// ── Factory ───────────────────────────────────────────────────────────────────
export function createHeroJourneyState(): HeroJourneyState {
  return {
    chapter: 'THE_CALL',
    turnNumber: 0,
    musicalKey: MUSICAL_KEYS.THE_CALL,
    chapterTransitioning: false,
    transitionProgress: 0,
  };
}

// ── Core Logic ────────────────────────────────────────────────────────────────

/**
 * Advance the turn counter and check for chapter transitions.
 */
export function advanceTurn(state: HeroJourneyState): {
  state: HeroJourneyState;
  chapterChanged: boolean;
  newChapter: ChapterPhase | null;
} {
  const turnNumber = state.turnNumber + 1;
  const newChapter = determineChapter(turnNumber);

  if (newChapter !== state.chapter) {
    return {
      state: {
        ...state,
        turnNumber,
        chapter: newChapter,
        musicalKey: MUSICAL_KEYS[newChapter],
        chapterTransitioning: true,
        transitionProgress: 0,
      },
      chapterChanged: true,
      newChapter,
    };
  }

  return {
    state: { ...state, turnNumber },
    chapterChanged: false,
    newChapter: null,
  };
}

function determineChapter(turn: number): ChapterPhase {
  if (turn >= CHAPTER_THRESHOLDS.THE_RETURN) return 'THE_RETURN';
  if (turn >= CHAPTER_THRESHOLDS.THE_ORDEAL) return 'THE_ORDEAL';
  return 'THE_CALL';
}

/**
 * Tick the chapter transition animation.
 */
export function tickTransition(
  state: HeroJourneyState,
  deltaMs: number,
): HeroJourneyState {
  if (!state.chapterTransitioning) return state;

  const progress = Math.min(1.0, state.transitionProgress + deltaMs / KEY_TRANSITION_DURATION_MS);
  const done = progress >= 1.0;

  return {
    ...state,
    transitionProgress: progress,
    chapterTransitioning: !done,
  };
}

/**
 * Get audio parameters for the current chapter.
 * Includes key signature, stem volumes, and mood.
 */
export function getChapterAudioParams(state: HeroJourneyState): ChapterAudioParams {
  const baseParams = CHAPTER_AUDIO_PROFILES[state.chapter];

  if (state.chapterTransitioning) {
    // During transition, interpolate between old and new
    return {
      ...baseParams,
      crossfade: state.transitionProgress,
      keyGlide: true,
    };
  }

  return { ...baseParams, crossfade: 1.0, keyGlide: false };
}

const CHAPTER_AUDIO_PROFILES: Record<ChapterPhase, ChapterAudioProfile> = {
  THE_CALL: {
    key: 'C_MAJOR',
    rootNote: 261.63,  // C4
    mode: 'major',
    tempo: 120,
    stemVolumes: {
      percussion: 0.4,
      bass: 0.5,
      harmonic: 0.6,
      melody: 0.3,
      ambient: 0.7,
    },
    mood: 'hopeful',
    filterCutoff: 6000,
  },
  THE_ORDEAL: {
    key: 'D_MINOR',
    rootNote: 293.66,  // D4
    mode: 'minor',
    tempo: 130,
    stemVolumes: {
      percussion: 0.8,
      bass: 0.7,
      harmonic: 0.4,
      melody: 0.5,
      ambient: 0.3,
    },
    mood: 'tense',
    filterCutoff: 3000,
  },
  THE_RETURN: {
    key: 'Eb_MAJOR',
    rootNote: 311.13,  // Eb4
    mode: 'major',
    tempo: 140,
    stemVolumes: {
      percussion: 0.9,
      bass: 0.8,
      harmonic: 0.8,
      melody: 0.9,
      ambient: 0.5,
    },
    mood: 'triumphant',
    filterCutoff: 12000,
  },
};

/**
 * Get visual parameters for chapter UI.
 */
export function getChapterVisuals(state: HeroJourneyState): ChapterVisuals {
  const chapterNames: Record<ChapterPhase, string> = {
    THE_CALL: 'I — The Call',
    THE_ORDEAL: 'II — The Ordeal',
    THE_RETURN: 'III — The Return',
  };

  const chapterColors: Record<ChapterPhase, string> = {
    THE_CALL: '#4488ff',
    THE_ORDEAL: '#ff4444',
    THE_RETURN: '#ffcc00',
  };

  return {
    chapterName: chapterNames[state.chapter],
    chapterColor: chapterColors[state.chapter],
    turnNumber: state.turnNumber,
    musicalKey: state.musicalKey.replace('_', ' '),
    transitioning: state.chapterTransitioning,
    transitionProgress: state.transitionProgress,
    backgroundGradient: getChapterGradient(state.chapter),
  };
}

function getChapterGradient(chapter: ChapterPhase): string {
  switch (chapter) {
    case 'THE_CALL':
      return 'linear-gradient(180deg, #0a0a1a 0%, #0d1a2a 100%)';
    case 'THE_ORDEAL':
      return 'linear-gradient(180deg, #1a0a0a 0%, #2a0d0d 100%)';
    case 'THE_RETURN':
      return 'linear-gradient(180deg, #1a1a0a 0%, #2a2a0d 100%)';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChapterAudioProfile {
  key: string;
  rootNote: number;
  mode: 'major' | 'minor';
  tempo: number;
  stemVolumes: {
    percussion: number;
    bass: number;
    harmonic: number;
    melody: number;
    ambient: number;
  };
  mood: string;
  filterCutoff: number;
}

export interface ChapterAudioParams extends ChapterAudioProfile {
  crossfade: number;
  keyGlide: boolean;
}

export interface ChapterVisuals {
  chapterName: string;
  chapterColor: string;
  turnNumber: number;
  musicalKey: string;
  transitioning: boolean;
  transitionProgress: number;
  backgroundGradient: string;
}
