import { useCallback, useEffect, useRef, useState } from 'react';
import { metrics } from '../debug/metrics';
import { createScopedLogger } from '../debug/trace';
import type {
  AudioAnalysisRequest,
  AudioAnalysisResponse,
  MusicAnalysis,
  MusicEngineStatus,
} from './types';

const log = createScopedLogger('MusicEngine');

export interface MusicEngineState {
  status: MusicEngineStatus;
  fileName: string | null;
  duration: number;
  currentTime: number;
  volume: number;
  progress: number;
  stage: string;
  analysis: MusicAnalysis | null;
  error: string | null;
}

const INITIAL_STATE: MusicEngineState = {
  status: 'idle',
  fileName: null,
  duration: 0,
  currentTime: 0,
  volume: 0.85,
  progress: 0,
  stage: 'idle',
  analysis: null,
  error: null,
};

export function useMusicEngine() {
  const [state, setState] = useState<MusicEngineState>(INITIAL_STATE);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const requestIdRef = useRef(0);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(new URL('./workers/audioAnalysis.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<AudioAnalysisResponse>) => {
      if (event.data.type === 'ANALYSIS_PROGRESS') {
        const { requestId, progress, stage } = event.data.payload;
        if (requestId !== requestIdRef.current) return;
        setState(current => ({
          ...current,
          progress,
          stage,
        }));
        return;
      }

      if (event.data.type === 'ANALYSIS_COMPLETE') {
        const { requestId, ...analysis } = event.data.payload;
        if (requestId !== requestIdRef.current) return;
        metrics.record('music_analysis_bpm', analysis.bpm, { sampleRate: analysis.sampleRate });
        metrics.record('music_analysis_rms', analysis.rms, { duration: analysis.duration });
        log.info('Analysis complete', {
          bpm: analysis.bpm,
          duration: analysis.duration,
          sampleRate: analysis.sampleRate,
        });
        setState(current => ({
          ...current,
          status: 'ready',
          progress: 1,
          stage: 'ready',
          duration: analysis.duration,
          analysis,
        }));
        return;
      }

      const { requestId, message: errorMessage } = event.data.payload;
      if (requestId !== requestIdRef.current) return;
      setState(current => ({
        ...current,
        status: 'error',
        error: errorMessage,
        stage: 'error',
      }));
      metrics.increment('errors_total');
      log.error('Worker analysis failed', errorMessage);
    };

    worker.onerror = error => {
      setState(current => ({
        ...current,
        status: 'error',
        error: error.message,
        stage: 'error',
      }));
      metrics.increment('errors_total');
      log.error('Worker crashed', error.message);
    };

    workerRef.current = worker;
    return worker;
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const worker = ensureWorker();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const startedAt = performance.now();

    setState(current => ({
      ...current,
      status: 'decoding',
      fileName: file.name,
      duration: 0,
      currentTime: 0,
      progress: 0.05,
      stage: 'decoding',
      analysis: null,
      error: null,
    }));

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    audioRef.current?.pause();

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    const audio = new Audio(objectUrl);
    audio.volume = state.volume;
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setState(current => ({
        ...current,
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : current.duration,
      }));
    };
    audio.onended = () => {
      audio.currentTime = 0;
      setState(current => ({ ...current, status: 'ready', currentTime: 0 }));
    };

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const audioContext = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = audioContext;

      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channel = decoded.getChannelData(0);
      const samples = new Float32Array(channel);
      const duration = decoded.duration;

      setState(current => ({
        ...current,
        status: 'analyzing',
        duration,
        progress: 0.2,
        stage: 'analyzing',
      }));

      const message: AudioAnalysisRequest = {
        type: 'ANALYZE_AUDIO',
        payload: {
          requestId,
          samples,
          sampleRate: decoded.sampleRate,
          duration,
        },
      };
      worker.postMessage(message, [samples.buffer]);
      metrics.record('music_decode_time', performance.now() - startedAt, {
        fileType: file.type || 'unknown',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState(current => ({
        ...current,
        status: 'error',
        error: `Unable to decode audio: ${message}`,
        stage: 'error',
      }));
      metrics.increment('errors_total');
      log.error('Audio decode failed', error);
    }
  }, [ensureWorker, state.volume]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    await audio.play();
    setState(current => ({ ...current, status: 'playing' }));
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setState(current => ({ ...current, status: 'paused' }));
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setState(current => ({ ...current, status: current.analysis ? 'ready' : 'idle', currentTime: 0 }));
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    setState(current => ({ ...current, currentTime: audio.currentTime }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume));
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
    setState(current => ({ ...current, volume: nextVolume }));
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      audioRef.current?.pause();
      audioContextRef.current?.close();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

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

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
