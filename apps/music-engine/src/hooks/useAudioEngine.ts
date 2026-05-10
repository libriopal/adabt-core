// ─── useAudioEngine Hook ────────────────────────────────────────────────────
// Provides React bindings to the AudioEngine singleton.
// Uses useSyncExternalStore for tear-free reads.

import { useSyncExternalStore, useCallback, useRef } from 'react';
import { AudioEngine, type AudioEngineState } from '../lib/audio-engine';

let engineInstance: AudioEngine | null = null;

function getEngine(): AudioEngine {
  if (!engineInstance) {
    engineInstance = new AudioEngine();
  }
  return engineInstance;
}

export function useAudioEngine() {
  const engineRef = useRef(getEngine());
  const engine = engineRef.current;

  const state = useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getState(),
  );

  const loadFile = useCallback((file: File) => engine.loadFile(file), [engine]);
  const play = useCallback(() => engine.play(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const stop = useCallback(() => engine.stop(), [engine]);
  const seek = useCallback((t: number) => engine.seek(t), [engine]);
  const setVolume = useCallback((v: number) => engine.setVolume(v), [engine]);

  return {
    state,
    loadFile,
    play,
    pause,
    stop,
    seek,
    setVolume,
  };
}
