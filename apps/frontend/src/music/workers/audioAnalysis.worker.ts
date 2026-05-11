import { analyzeAudio } from '../dsp';
import type { AudioAnalysisRequest, AudioAnalysisResponse } from '../types';

type WorkerContext = {
  postMessage: (message: AudioAnalysisResponse) => void;
  onmessage: ((event: MessageEvent<AudioAnalysisRequest>) => void) | null;
};

const ctx = self as unknown as WorkerContext;

ctx.onmessage = (event: MessageEvent<AudioAnalysisRequest>) => {
  if (event.data.type !== 'ANALYZE_AUDIO') return;

  try {
    const { requestId, samples, sampleRate, duration } = event.data.payload;
    const analysis = analyzeAudio(samples, sampleRate, duration, (progress, stage) => {
      ctx.postMessage({
        type: 'ANALYSIS_PROGRESS',
        payload: { requestId, progress, stage },
      } satisfies AudioAnalysisResponse);
    });

    ctx.postMessage({
      type: 'ANALYSIS_COMPLETE',
      payload: { ...analysis, requestId },
    } satisfies AudioAnalysisResponse);
  } catch (error) {
    ctx.postMessage({
      type: 'ANALYSIS_ERROR',
      payload: {
        requestId: event.data.payload.requestId,
        message: error instanceof Error ? error.message : String(error),
      },
    } satisfies AudioAnalysisResponse);
  }
};
