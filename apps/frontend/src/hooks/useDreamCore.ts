// ─────────────────────────────────────────────────────
// DREAM-CORE — React Hook: Main Orchestrator
// Bridges the dream store with the audio engine and game loop.
// ─────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import { useDreamStore } from '../../../../packages/dream-core/src/state/dreamStore';
import { dreamAudio } from '../../../../packages/dream-core/src/audio/DreamAudioEngine';
import { getHeartbeatAudioParams } from '../../../../packages/dream-core/src/genres/horror';
import { getDecorationAudioParams } from '../../../../packages/dream-core/src/genres/simulation';
import { getTrickAudioIntensity } from '../../../../packages/dream-core/src/genres/sports';
import { getChapterAudioParams } from '../../../../packages/dream-core/src/genres/adventure';
import type { DieFace, DiceClass } from '../../../../packages/dream-core/src/types';

export function useDreamCore(bpm: number = 120) {
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  const initMatch = useDreamStore(s => s.initMatch);
  const tick = useDreamStore(s => s.tick);
  const processRoll = useDreamStore(s => s.processRoll);
  const triggerFarkle = useDreamStore(s => s.triggerFarkle);
  const attemptBreaker = useDreamStore(s => s.attemptBreaker);
  const bankSuccess = useDreamStore(s => s.bankSuccess);
  const bankFarkle = useDreamStore(s => s.bankFarkle);
  const nextTurn = useDreamStore(s => s.nextTurn);
  const wrapScore = useDreamStore(s => s.wrapScore);

  // ── Initialize ──────────────────────────────────────────────────────────────

  useEffect(() => {
    dreamAudio.init();
    initMatch(bpm);

    // Game loop
    const gameLoop = (now: number) => {
      const delta = lastTickRef.current ? now - lastTickRef.current : 16;
      lastTickRef.current = now;
      tick(delta);
      rafRef.current = requestAnimationFrame(gameLoop);
    };
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      dreamAudio.destroy();
    };
  }, [bpm, initMatch, tick]);

  // ── Audio Sync ──────────────────────────────────────────────────────────────

  // Subscribe to heartbeat changes
  useEffect(() => {
    return useDreamStore.subscribe(
      s => s.heartbeat.active,
      (active) => {
        if (active) {
          const heartbeat = useDreamStore.getState().heartbeat;
          const params = getHeartbeatAudioParams(heartbeat);
          dreamAudio.startHeartbeat(params);
        } else {
          dreamAudio.stopHeartbeat();
          dreamAudio.restoreAllStems();
        }
      },
    );
  }, []);

  // Subscribe to trick meter changes
  useEffect(() => {
    return useDreamStore.subscribe(
      s => s.trickMeter.level,
      () => {
        const trickMeter = useDreamStore.getState().trickMeter;
        const params = getTrickAudioIntensity(trickMeter);
        dreamAudio.applyTrickMeter(params);
      },
    );
  }, []);

  // Subscribe to chapter changes
  useEffect(() => {
    return useDreamStore.subscribe(
      s => s.heroJourney.chapter,
      () => {
        const heroJourney = useDreamStore.getState().heroJourney;
        const params = getChapterAudioParams(heroJourney);
        dreamAudio.applyChapterAudio(params);
      },
    );
  }, []);

  // Subscribe to decoration changes
  useEffect(() => {
    return useDreamStore.subscribe(
      s => s.acoustic.equippedDecoration,
      () => {
        const acoustic = useDreamStore.getState().acoustic;
        const config = getDecorationAudioParams(acoustic);
        dreamAudio.applyDecoration(config);
      },
    );
  }, []);

  // ── Action Handlers ─────────────────────────────────────────────────────────

  const handleRoll = useCallback(() => {
    dreamAudio.resume();
    const accuracy = processRoll(Date.now());
    return accuracy;
  }, [processRoll]);

  const handleBank = useCallback((score: number, faces: number[], bankedBefore: number) => {
    const isFrenzy = useDreamStore.getState().trickMeter.level === 'FRENZY';
    const wrappedScore = wrapScore(score, faces, bankedBefore, isFrenzy);
    bankSuccess();
    nextTurn();
    dreamAudio.playBank(wrappedScore);
    return wrappedScore;
  }, [wrapScore, bankSuccess, nextTurn]);

  const handleFarkle = useCallback(() => {
    triggerFarkle();
    bankFarkle();
    dreamAudio.playFarkle();
    // Player has 250ms to attempt a combo breaker
    return { canBreak: true };
  }, [triggerFarkle, bankFarkle]);

  const handleComboBreaker = useCallback(() => {
    const success = attemptBreaker();
    if (success) {
      dreamAudio.playReversalSting();
    }
    return success;
  }, [attemptBreaker]);

  return {
    handleRoll,
    handleBank,
    handleFarkle,
    handleComboBreaker,
    audio: dreamAudio,
  };
}
