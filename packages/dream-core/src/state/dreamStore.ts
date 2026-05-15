// ─────────────────────────────────────────────────────
// DREAM-CORE — Zustand State Store
// Combines all 20 genre states into a single reactive store.
// Uses subscribeWithSelector for efficient partial subscriptions.
// ─────────────────────────────────────────────────────

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { DreamCoreState } from '../types';
import type { DieFace } from '../../../farkle-shared/src/types';

// Genre state factories
import { createPrecisionStrikeState } from '../genres/fps';
import { generateSealedTiles } from '../genres/metroidvania';
import { createFacetState } from '../genres/roguelike';
import { createRhythmState } from '../genres/rhythm';
import { createClosingCircleState } from '../genres/battle-royale';
import { createComboBreakerState } from '../genres/fighting';
import { createDiceClassState } from '../genres/rpg';
import { createVolatilityState } from '../genres/casino';
import { createGravityState } from '../genres/platformer';
import { createHiddenPocketState } from '../genres/stealth';
import { createSlipstreamState } from '../genres/racing';
import { createTerritoryState } from '../genres/strategy';
import { createHeartbeatState } from '../genres/horror';
import { createAcousticState } from '../genres/simulation';
import { createTrickMeterState } from '../genres/sports';
import { createHeroJourneyState } from '../genres/adventure';
import { createBuildADieState } from '../genres/sandbox';
import { createUltimateState } from '../genres/moba';
import { createRuleShardState } from '../genres/abstract';

// Genre action imports
import { evaluateCourage, spendToken } from '../genres/fps';
import { attemptUnseal, type SealCheckContext } from '../genres/metroidvania';
import { equipFacet, tickFacetRound, applyFacetToScore, getActiveModifier, computeFarkleRecovery } from '../genres/roguelike';
import type { FacetId } from '../types';
import { processRollAccuracy, tickRhythm, evaluateBeatAccuracy } from '../genres/rhythm';
import type { BeatAccuracy } from '../types';
import { tickClosingCircle } from '../genres/battle-royale';
import { openReversalWindow, attemptComboBreaker, tickComboBreaker } from '../genres/fighting';
import { selectDiceClass, attemptShieldAbsorb, useClassAbility } from '../genres/rpg';
import type { DiceClass } from '../types';
import { recordRollResult, tickVolatility } from '../genres/casino';
import { tickGravity, finishSettling } from '../genres/platformer';
import { pocketDie, deployPocketedDie } from '../genres/stealth';
import { updateSlipstream } from '../genres/racing';
import { claimTerritory, contestTerritory } from '../genres/strategy';
import { evaluateHeartbeat, resolveHeartbeat, tickHeartbeatVignette } from '../genres/horror';
import { unlockDecoration, equipDecoration, checkDecorationMilestones, type MilestoneContext } from '../genres/simulation';
import { recordBank as trickRecordBank, recordFarkle as trickRecordFarkle } from '../genres/sports';
import { advanceTurn, tickTransition } from '../genres/adventure';
import { awardShard, buildCustomDie, deployDie, rollCustomDie } from '../genres/sandbox';
import type { CustomDie, AcousticDecorationId } from '../types';
import { addCharge, loseChargeOnFarkle, fireUltimate } from '../genres/moba';
import { activateRuleShard, tickRuleShard, applyRuleShard } from '../genres/abstract';
import type { RuleShardEffect } from '../types';

// ── Store Interface ───────────────────────────────────────────────────────────

export interface DreamStoreActions {
  // Initialization
  initMatch: (bpm?: number, totalPlayers?: number) => void;

  // FPS
  evaluateCourage: (unbanked: number, chainScore: number) => void;
  spendPrecisionToken: () => boolean;

  // Metroidvania
  checkUnseals: (context: SealCheckContext) => void;

  // Roguelike
  equipFacet: (facetId: FacetId) => void;
  endRound: () => void;

  // Rhythm
  processRoll: (actionTimeMs: number) => BeatAccuracy;

  // Battle Royale
  tickCircle: () => void;

  // Fighting
  triggerFarkle: () => void;
  attemptBreaker: () => boolean;

  // RPG
  selectClass: (diceClass: DiceClass) => void;
  useAbility: () => void;

  // Casino
  recordScore: (score: number) => void;

  // Platformer
  advanceGravity: () => void;
  settleGravity: () => void;

  // Stealth
  pocket: (face: DieFace) => boolean;
  deploy: () => DieFace | null;

  // Racing
  updatePositions: (playerScore: number, allScores: number[]) => void;

  // Strategy
  claim: (territoryId: number, playerId: string) => void;

  // Horror
  checkHeartbeat: (totalDice: number, scoringDice: number) => void;
  resolveHeartbeatSurvival: (survived: boolean) => void;

  // Simulation
  checkMilestones: (context: MilestoneContext) => void;
  equip: (decorationId: AcousticDecorationId | null) => void;

  // Sports
  bankSuccess: () => void;
  bankFarkle: () => void;

  // Adventure
  nextTurn: () => void;

  // Sandbox
  addShard: () => void;
  buildDie: (faces: [DieFace, DieFace, DieFace, DieFace, DieFace, DieFace], skin?: CustomDie['skin']) => boolean;
  deployCustomDie: () => boolean;

  // MOBA
  chargeUltimate: (bankedScore: number, multiplier?: number) => void;
  fireUltimate: () => boolean;

  // Abstract
  activateRule: (effect: RuleShardEffect) => void;

  // Global tick (call per frame)
  tick: (deltaMs: number) => void;

  // Score wrapper (call AFTER Sacred Core lookupScore)
  wrapScore: (baseScore: number, faces: number[], bankedBefore: number, isFrenzy: boolean) => number;

  // Reset
  reset: () => void;
}

export type DreamStore = DreamCoreState & DreamStoreActions;

// ── Default RNG ───────────────────────────────────────────────────────────────
// Deterministic wrapper RNG for genre layout/draft state. Authoritative dice
// outcomes still belong to the Sacred Core CSPRNG path.
let defaultRngState = 0xD12EA5E;
const defaultRng = () => {
  defaultRngState = (defaultRngState + 0x6D2B79F5) >>> 0;
  let t = defaultRngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ── Store ─────────────────────────────────────────────────────────────────────

function createInitialState(): DreamCoreState {
  return {
    precisionStrike: createPrecisionStrikeState(),
    sealedTiles: generateSealedTiles(defaultRng),
    facet: createFacetState(),
    rhythm: createRhythmState(),
    closingCircle: createClosingCircleState(),
    comboBreaker: createComboBreakerState(),
    diceClass: createDiceClassState(),
    volatility: createVolatilityState(),
    gravity: createGravityState(),
    hiddenPocket: createHiddenPocketState(),
    slipstream: createSlipstreamState(),
    territory: createTerritoryState(),
    heartbeat: createHeartbeatState(),
    acoustic: createAcousticState(),
    trickMeter: createTrickMeterState(),
    heroJourney: createHeroJourneyState(),
    buildADie: createBuildADieState(),
    ultimate: createUltimateState(),
    ruleShard: createRuleShardState(),
    turnNumber: 0,
    matchStartedAt: Date.now(),
    gridSize: 60,
  };
}

export const useDreamStore = create<DreamStore>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialState(),

    // ── Initialization ────────────────────────────────────────────────
    initMatch: (bpm = 120, totalPlayers = 2) => {
      set({
        ...createInitialState(),
        rhythm: createRhythmState(bpm),
        slipstream: createSlipstreamState(totalPlayers),
        matchStartedAt: Date.now(),
      });
    },

    // ── FPS ───────────────────────────────────────────────────────────
    evaluateCourage: (unbanked, chainScore) => {
      set(s => ({
        precisionStrike: evaluateCourage(s.precisionStrike, unbanked, chainScore),
      }));
    },

    spendPrecisionToken: () => {
      const { precisionStrike } = get();
      const result = spendToken(precisionStrike);
      if (result.spent) {
        set({ precisionStrike: result.state });
      }
      return result.spent;
    },

    // ── Metroidvania ──────────────────────────────────────────────────
    checkUnseals: (context) => {
      set(s => {
        const result = attemptUnseal(s.sealedTiles, context);
        // Award shards for unsealed tiles
        let buildADie = s.buildADie;
        for (const _unseal of result.grantedRewards) {
          if (_unseal.type === 'die_shard') {
            buildADie = { ...buildADie, shards: buildADie.shards + 1 };
          }
        }
        return { sealedTiles: result.tiles, buildADie };
      });
    },

    // ── Roguelike ─────────────────────────────────────────────────────
    equipFacet: (facetId) => {
      set(s => ({ facet: equipFacet(s.facet, facetId) }));
    },

    endRound: () => {
      set(s => {
        const result = tickFacetRound(s.facet);
        return { facet: result.state };
      });
    },

    // ── Rhythm ────────────────────────────────────────────────────────
    processRoll: (actionTimeMs) => {
      const s = get();
      const audioStartMs = s.matchStartedAt;
      const effectiveWindow = s.rhythm.beatWindowMs +
        (s.diceClass.selectedClass === 'BARD' ? 30 : 0);

      const accuracy = evaluateBeatAccuracy(
        actionTimeMs,
        s.rhythm.bpm,
        audioStartMs,
        effectiveWindow * s.slipstream.beatWindowModifier,
      );

      set(s2 => ({
        rhythm: processRollAccuracy(s2.rhythm, accuracy, actionTimeMs),
      }));

      return accuracy;
    },

    // ── Battle Royale ─────────────────────────────────────────────────
    tickCircle: () => {
      set(s => ({
        closingCircle: tickClosingCircle(s.closingCircle, Date.now(), s.gridSize),
      }));
    },

    // ── Fighting ──────────────────────────────────────────────────────
    triggerFarkle: () => {
      set(s => ({
        comboBreaker: openReversalWindow(s.comboBreaker),
      }));
    },

    attemptBreaker: () => {
      const s = get();
      const result = attemptComboBreaker(s.comboBreaker, s.precisionStrike);
      set({
        comboBreaker: result.breakerState,
        precisionStrike: result.precisionState,
      });
      return result.success;
    },

    // ── RPG ───────────────────────────────────────────────────────────
    selectClass: (diceClass) => {
      set(s => {
        const newState = selectDiceClass(s.diceClass, diceClass);
        // Artificer starts with 3 shards
        if (diceClass === 'ARTIFICER' && s.diceClass.selectedClass === null) {
          return {
            diceClass: newState,
            buildADie: { ...s.buildADie, shards: s.buildADie.shards + 3 },
          };
        }
        // Rogue gets extra pocket
        if (diceClass === 'ROGUE' && s.diceClass.selectedClass === null) {
          return {
            diceClass: newState,
            hiddenPocket: { ...s.hiddenPocket, maxPockets: 2 },
          };
        }
        return { diceClass: newState };
      });
    },

    useAbility: () => {
      set(s => {
        const result = useClassAbility(s.diceClass);
        if (!result.effect) return {};

        const updates: Partial<DreamCoreState> = { diceClass: result.state };

        // Apply ability effects
        switch (result.effect.type) {
          case 'CRESCENDO':
            updates.rhythm = {
              ...s.rhythm,
              frenzyExpiresAt: s.rhythm.frenzyExpiresAt + result.effect.frenzyExtensionMs,
            };
            break;
          // Other effects handled in wrapScore or tick
        }

        return updates;
      });
    },

    // ── Casino ────────────────────────────────────────────────────────
    recordScore: (score) => {
      set(s => ({
        volatility: recordRollResult(s.volatility, score),
      }));
    },

    // ── Platformer ────────────────────────────────────────────────────
    advanceGravity: () => {
      set(s => {
        const result = tickGravity(s.gravity);
        return { gravity: result.state };
      });
    },

    settleGravity: () => {
      set(s => ({ gravity: finishSettling(s.gravity) }));
    },

    // ── Stealth ───────────────────────────────────────────────────────
    pocket: (face) => {
      const result = pocketDie(get().hiddenPocket, face);
      if (result.success) set({ hiddenPocket: result.state });
      return result.success;
    },

    deploy: () => {
      const result = deployPocketedDie(get().hiddenPocket);
      if (result.deployedFace !== null) set({ hiddenPocket: result.state });
      return result.deployedFace;
    },

    // ── Racing ────────────────────────────────────────────────────────
    updatePositions: (playerScore, allScores) => {
      set(s => ({
        slipstream: updateSlipstream(s.slipstream, playerScore, allScores),
      }));
    },

    // ── Strategy ──────────────────────────────────────────────────────
    claim: (territoryId, playerId) => {
      set(s => ({
        territory: claimTerritory(s.territory, territoryId, playerId),
      }));
    },

    // ── Horror ────────────────────────────────────────────────────────
    checkHeartbeat: (totalDice, scoringDice) => {
      set(s => ({
        heartbeat: evaluateHeartbeat(totalDice, scoringDice, s.heartbeat),
      }));
    },

    resolveHeartbeatSurvival: (survived) => {
      set(s => {
        const result = resolveHeartbeat(survived, s.heartbeat);
        return { heartbeat: result.state };
      });
    },

    // ── Simulation ────────────────────────────────────────────────────
    checkMilestones: (context) => {
      set(s => {
        const newUnlocks = checkDecorationMilestones(s.acoustic, context);
        let acoustic = s.acoustic;
        for (const id of newUnlocks) {
          acoustic = unlockDecoration(acoustic, id);
        }
        return { acoustic };
      });
    },

    equip: (decorationId) => {
      set(s => ({
        acoustic: equipDecoration(s.acoustic, decorationId),
      }));
    },

    // ── Sports ────────────────────────────────────────────────────────
    bankSuccess: () => {
      set(s => ({ trickMeter: trickRecordBank(s.trickMeter) }));
    },

    bankFarkle: () => {
      set(s => ({ trickMeter: trickRecordFarkle(s.trickMeter) }));
    },

    // ── Adventure ─────────────────────────────────────────────────────
    nextTurn: () => {
      set(s => {
        const result = advanceTurn(s.heroJourney);
        return {
          heroJourney: result.state,
          turnNumber: s.turnNumber + 1,
        };
      });
    },

    // ── Sandbox ───────────────────────────────────────────────────────
    addShard: () => {
      set(s => ({ buildADie: awardShard(s.buildADie) }));
    },

    buildDie: (faces, skin: CustomDie['skin'] = 'OBSIDIAN') => {
      const result = buildCustomDie(get().buildADie, faces, skin);
      if (result.success) set({ buildADie: result.state });
      return result.success;
    },

    deployCustomDie: () => {
      const result = deployDie(get().buildADie);
      if (result.deployed) set({ buildADie: result.state });
      return result.deployed;
    },

    // ── MOBA ──────────────────────────────────────────────────────────
    chargeUltimate: (bankedScore, multiplier = 1.0) => {
      set(s => ({
        ultimate: addCharge(s.ultimate, bankedScore, multiplier),
      }));
    },

    fireUltimate: () => {
      const result = fireUltimate(get().ultimate);
      if (result.fired) set({ ultimate: result.state });
      return result.fired;
    },

    // ── Abstract ──────────────────────────────────────────────────────
    activateRule: (effect) => {
      set(s => ({
        ruleShard: activateRuleShard(s.ruleShard, effect),
      }));
    },

    // ── Global Tick ───────────────────────────────────────────────────
    tick: (deltaMs) => {
      set(s => ({
        rhythm: tickRhythm(s.rhythm, Date.now(), s.matchStartedAt),
        comboBreaker: tickComboBreaker(s.comboBreaker),
        volatility: tickVolatility(s.volatility),
        heartbeat: tickHeartbeatVignette(s.heartbeat, deltaMs),
        heroJourney: tickTransition(s.heroJourney, deltaMs),
        ruleShard: tickRuleShard(s.ruleShard),
      }));
    },

    // ── Score Wrapper ─────────────────────────────────────────────────
    wrapScore: (baseScore, faces, bankedBefore, isFrenzy) => {
      const s = get();
      let score = baseScore;

      // Facet modifier
      const modifier = getActiveModifier(s.facet);
      score = applyFacetToScore(score, bankedBefore, modifier, isFrenzy);

      // Rule Shard
      const shardResult = applyRuleShard(score, faces, s.ruleShard);
      score = shardResult.modifiedScore;

      // Territory bonus
      score = Math.round(score * s.territory.playerBonusMultiplier);

      // Rhythm flow multiplier
      score = Math.round(score * s.rhythm.flowMultiplier);

      // Trick meter juice
      score = Math.round(score * s.trickMeter.juiceMultiplier);

      // Volatility surge
      score = Math.round(score * s.volatility.juiceAmplifier);

      return score;
    },

    // ── Reset ─────────────────────────────────────────────────────────
    reset: () => {
      set(createInitialState());
    },
  }))
);
