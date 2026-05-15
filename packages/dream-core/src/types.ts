// ─────────────────────────────────────────────────────
// DREAM-CORE — Genre Fusion Type System
// All types for the 20-genre Fused Experience Blueprint.
// These are presentation/modifier wrappers.
// Sacred Core (farkleScorer, CSPRNG, rtpConfig, types.ts) is UNTOUCHED.
// ─────────────────────────────────────────────────────

import type { DieFace } from '../../farkle-shared/src/types';

// ── Genre Hierarchy (descending dominance) ────────────────────────────────────
export type GenreTag =
  | 'HORROR' | 'ROGUELIKE' | 'CASINO' | 'MATCH3' | 'RHYTHM'
  | 'FPS' | 'METROIDVANIA' | 'BATTLE_ROYALE' | 'FIGHTING' | 'RPG'
  | 'PLATFORMER' | 'STEALTH' | 'RACING' | 'STRATEGY' | 'SIMULATION'
  | 'SPORTS' | 'ADVENTURE' | 'SANDBOX' | 'MOBA' | 'ABSTRACT';

// ── 1. FPS — Precision Strike ─────────────────────────────────────────────────
export interface PrecisionStrikeState {
  tokens: number;          // uint8: earned by continuing past 500 unbanked
  lastBankWasCourageous: boolean;
}

// ── 2. Metroidvania — Ability-Gated Tiles ─────────────────────────────────────
export type SealCondition =
  | { type: 'consecutive_on_beat'; count: number }
  | { type: 'straight_4plus' }
  | { type: 'exact_bank'; target: number }
  | { type: 'streak'; count: number };

export type SealReward =
  | { type: 'multiplier'; value: number }
  | { type: 'free_reroll' }
  | { type: 'wildcard_die' }
  | { type: 'rule_shard'; shardId: string }
  | { type: 'die_shard' }
  | { type: 'acoustic_decoration'; decorationId: string };

export interface SealedTile {
  tileIndex: number;       // 0–59
  condition: SealCondition;
  reward: SealReward;
  sealed: boolean;
  glowIntensity: number;   // 0.0–1.0, pulses when near-unlock
}

// ── 3. Roguelike — Facet Mutations ────────────────────────────────────────────
export type FacetId =
  | 'MISER' | 'HOARDER'
  | 'GLUTTON' | 'ABYSSAL'
  | 'ALCHEMIST' | 'PHILOSOPHER'
  | 'GAMBLER' | 'CARDSHARP'
  | 'SENTINEL' | 'BULWARK';

export interface FacetDef {
  id: FacetId;
  name: string;
  description: string;
  mutatesTo: FacetId | null;
  mutationThreshold: number;  // rounds to mutate
  modifier: FacetModifier;
}

export interface FacetModifier {
  scoreMultiplier?: number;
  bankThresholdBonus?: number;
  farkleRecoveryPct?: number;
  lfoRateMultiplier?: number;
  extraRollOnFarkle?: boolean;
  riskAmplifier?: number;
}

export interface FacetState {
  equipped: FacetId | null;
  roundsEquipped: number;
  mutationTier: number;
  availableFacets: FacetId[];
}

// ── 4. Rhythm — Perfect Beat Window ──────────────────────────────────────────
export interface RhythmState {
  bpm: number;
  lastBeatTimestamp: number;
  beatWindowMs: number;        // default 100ms, modified by Slipstream
  comboStreak: number;         // consecutive Perfects
  flowMultiplier: number;      // 1.0–2.0
  frenzyActive: boolean;       // true when comboStreak >= 5
  frenzyExpiresAt: number;
  beatPhase: number;           // 0.0–1.0 within current beat
}

export type BeatAccuracy = 'PERFECT' | 'GOOD' | 'MISS';

// ── 5. Match-3 — Phantasmagoric Chain ─────────────────────────────────────────
export interface ChainReaction {
  chainDepth: number;
  tilesAffected: number[];     // tile indices
  unsealsTriggered: number[];  // sealed tile indices unlocked
  visualIntensity: number;     // 1.0 per chain link
}

// ── 6. Battle Royale — Closing Circle ─────────────────────────────────────────
export interface ClosingCircleState {
  radius: number;              // current safe radius (10 → 3)
  tickIntervalMs: number;      // shrink every N ms (default 30000)
  lastShrinkAt: number;
  scorchedTiles: Set<number>;  // tile indices that are scorched
  scorched: Set<number>;       // alias for scorchedTiles (UI convenience)
  active: boolean;             // true when circle is actively shrinking
}

// ── 7. Fighting — Combo Breaker ───────────────────────────────────────────────
export interface ComboBreakerState {
  windowActive: boolean;
  windowExpiresAt: number;     // 250ms from Farkle animation start
  tokenCost: number;           // 1 Precision Strike token
}

// ── 8. RPG — Dice Classes ─────────────────────────────────────────────────────
export type DiceClass = 'PALADIN' | 'ROGUE' | 'BARD' | 'ARTIFICER';

export interface DiceClassDef {
  id: DiceClass;
  name: string;
  passive: string;
  ability: string;
  audioStemLayer: string;
  flowMultiplierCap: number;
  hiddenPockets: number;
  shieldCharges: number;
}

export interface DiceClassState {
  selectedClass: DiceClass | null;
  shieldUsed: boolean;
  classAbilityCharges: number;
}

// ── 9. Casino — Volatility Surge ──────────────────────────────────────────────
export interface VolatilityState {
  recentScores: number[];      // last 5 roll scores (ring buffer)
  variance: number;            // computed variance
  standardDeviation: number;   // sqrt(variance), for oscilloscope
  surgeActive: boolean;        // true when variance exceeds threshold
  surgeExpiresAt: number;
  juiceAmplifier: number;      // 1.0 normal, 2.0 during surge
}

// ── 10. Platformer — Gravity Flip ─────────────────────────────────────────────
export type GravityDirection = 'DOWN' | 'RIGHT' | 'UP' | 'LEFT';

export interface GravityState {
  currentDirection: GravityDirection;
  turnsSinceFlip: number;
  flipInterval: number;        // every N turns (default 5)
  settling: boolean;           // true during 400ms CSS physics animation
}

// ── 11. Stealth — Hidden Pocket ───────────────────────────────────────────────
export interface HiddenPocketState {
  pocketedDie: DieFace | null;
  pocketUsed: boolean;
  maxPockets: number;          // 1 default, 2 for Rogue class
}

// ── 12. Racing — Slipstream ───────────────────────────────────────────────────
export interface SlipstreamState {
  playerPosition: number;      // 1st, 2nd, etc.
  totalPlayers: number;
  beatWindowModifier: number;  // 0.75 for 1st, 1.0 for middle, 1.5 for last
  flowCapModifier: number;
}

// ── 13. Strategy — Territory Control ──────────────────────────────────────────
export interface Territory {
  id: number;                  // 0–5
  tileIndices: number[];       // 10 tiles per territory
  ownerId: string | null;
  contested: boolean;
  domainActive: boolean;       // 3+ adjacent territories = Domain
}

export interface TerritoryState {
  territories: Territory[];
  playerBonusMultiplier: number; // +5% per claimed territory
}

// ── 14. Horror — Heartbeat LFO ────────────────────────────────────────────────
export interface HeartbeatState {
  active: boolean;
  nonScoringDice: number;      // how many of 6 dice are non-scoring
  lfoFrequency: number;        // 40Hz sub-bass
  lfoBpm: number;              // 140 BPM heartbeat
  bpm: number;                 // alias for lfoBpm (UI convenience)
  stemsMuted: boolean;
  vignetteIntensity: number;   // 0.0–1.0
  revealDelayMs: number;       // max 320ms during heartbeat
  flatlineActive: boolean;     // true on Farkle during heartbeat
  flatlined: boolean;          // alias for flatlineActive (UI convenience)
}

// ── 15. Simulation — Acoustic Decorations ─────────────────────────────────────
export type AcousticDecorationId =
  | 'CATHEDRAL_REVERB' | 'VINYL_CRACKLE' | 'BIT_CRUSHER'
  | 'HALL_OF_MIRRORS' | 'UNDERWATER' | 'VOID_ECHO';

export interface AcousticDecoration {
  id: AcousticDecorationId;
  name: string;
  description: string;
  audioParams: {
    reverbDecay?: number;
    filterFreq?: number;
    bitDepth?: number;
    delayTaps?: number;
    delayTimeMs?: number;
    wetMix?: number;
  };
  unlockedAt: string;          // milestone description
}

export interface AcousticState {
  equippedDecoration: AcousticDecorationId | null;
  unlockedDecorations: AcousticDecorationId[];
}

// ── 16. Sports — Trick Meter ──────────────────────────────────────────────────
export type TrickLevel = 'COLD' | 'WARM' | 'HOT' | 'FRENZY';

export interface TrickMeterState {
  streak: number;              // consecutive banks without Farkle
  level: TrickLevel;
  juiceMultiplier: number;     // 1.0 → 2.0 at FRENZY
  facetDoubled: boolean;       // true at FRENZY (8+ streak)
}

// ── 17. Adventure — Hero's Journey Keys ───────────────────────────────────────
export type ChapterPhase = 'THE_CALL' | 'THE_ORDEAL' | 'THE_RETURN';

export interface HeroJourneyState {
  chapter: ChapterPhase;
  turnNumber: number;
  musicalKey: string;          // 'C_MAJOR' | 'D_MINOR' | 'Eb_MAJOR'
  chapterTransitioning: boolean;
  transitionProgress: number;  // 0.0–1.0 during key change glide
}

// ── 18. Sandbox — Build-a-Die ─────────────────────────────────────────────────
export interface CustomDie {
  faces: [DieFace, DieFace, DieFace, DieFace, DieFace, DieFace];
  skin: 'GLASS' | 'GOLD' | 'OBSIDIAN' | 'NEON';
  soundProfile: AcousticDecorationId;
  name: string;
}

export interface BuildADieState {
  shards: number;              // 6 shards = 1 custom die
  customDie: CustomDie | null;
  deployed: boolean;           // true when 7th die is in play
}

// ── 19. MOBA — The Ultimate ───────────────────────────────────────────────────
export interface UltimateState {
  charge: number;              // 0–100
  chargePerBank: number;       // score / 100
  chargeLossOnFarkle: number;  // -15
  ready: boolean;              // true when charge >= 100
  fired: boolean;              // true after activation, resets to 0
  maxRerolls: number;          // server re-roll cap (3)
}

// ── 20. Abstract — Rules Are Fluid ────────────────────────────────────────────
export type RuleShardEffect =
  | { type: 'EVENS_ARE_ODDS'; bonusPerEven: number }
  | { type: 'PAIRS_PAY'; pairBonus: number }
  | { type: 'INVERSE_FARKLE' };

export interface RuleShardState {
  activeRule: RuleShardEffect | null;
  expiresAt: number;           // Date.now() + 30000
  durationMs: number;          // 30000
}

// ── Master Dream State ────────────────────────────────────────────────────────
export interface DreamCoreState {
  // Per-player genre states
  precisionStrike: PrecisionStrikeState;
  sealedTiles: SealedTile[];
  facet: FacetState;
  rhythm: RhythmState;
  closingCircle: ClosingCircleState;
  comboBreaker: ComboBreakerState;
  diceClass: DiceClassState;
  volatility: VolatilityState;
  gravity: GravityState;
  hiddenPocket: HiddenPocketState;
  slipstream: SlipstreamState;
  territory: TerritoryState;
  heartbeat: HeartbeatState;
  acoustic: AcousticState;
  trickMeter: TrickMeterState;
  heroJourney: HeroJourneyState;
  buildADie: BuildADieState;
  ultimate: UltimateState;
  ruleShard: RuleShardState;

  // Global
  turnNumber: number;
  matchStartedAt: number;
  gridSize: number;            // 60 tiles default
}
