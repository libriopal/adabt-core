// ─── Decode Worker ──────────────────────────────────────────────────────────
// Decodes MP3/audio files into PCM Float32 chunks.
// Uses OfflineAudioContext (available in workers) for decoding.
// Sends chunks back via transferable ArrayBuffers for zero-copy.
//
// Cancellation: checks `cancelled` flag between processing stages.
// Telemetry: reports decode timing and throughput.

import type {
  DecodeWorkerInbound,
  DecodeProgress,
  DecodeChunk,
  DecodeComplete,
  DecodeError,
  TelemetryEvent,
} from '../types/worker-messages';

// Track multiple cancelled sequences — prevents stale decodes from
// becoming "un-cancelled" when a newer request starts.
const cancelledSeqIds = new Set<number>();

function isCancelled(seqId: number): boolean {
  return cancelledSeqIds.has(seqId);
}

function sendProgress(seqId: number, percent: number, decodedSamples: number): void {
  const msg: DecodeProgress = {
    type: 'decode:progress',
    seqId,
    percent,
    decodedSamples,
  };
  self.postMessage(msg);
}

function sendChunk(
  seqId: number,
  pcmData: Float32Array,
  sampleRate: number,
  channels: number,
  chunkIndex: number,
): void {
  const msg: DecodeChunk = {
    type: 'decode:chunk',
    seqId,
    pcmData,
    sampleRate,
    channels,
    chunkIndex,
  };
  // Transfer the Float32Array's buffer for zero-copy
  self.postMessage(msg, [pcmData.buffer]);
}

function sendComplete(
  seqId: number,
  totalSamples: number,
  sampleRate: number,
  channels: number,
  duration: number,
): void {
  const msg: DecodeComplete = {
    type: 'decode:complete',
    seqId,
    totalSamples,
    sampleRate,
    channels,
    duration,
  };
  self.postMessage(msg);
}

function sendError(seqId: number, error: string): void {
  const msg: DecodeError = {
    type: 'decode:error',
    seqId,
    error,
  };
  self.postMessage(msg);
}

function sendTelemetry(event: string, data: Record<string, unknown>): void {
  const msg: TelemetryEvent = {
    type: 'telemetry',
    worker: 'decode',
    event,
    data,
    timestamp: performance.now(),
  };
  self.postMessage(msg);
}

async function decodeAudio(seqId: number, fileData: ArrayBuffer, fileName: string): Promise<void> {
  const startTime = performance.now();
  sendTelemetry('decode:start', { fileName, fileSize: fileData.byteLength });
  sendProgress(seqId, 0, 0);

  if (isCancelled(seqId)) return;

  try {
    // Use OfflineAudioContext for worker-based decoding
    // First we need to know the audio params - use a small context to decode
    const tempCtx = new OfflineAudioContext(2, 1, 44100);
    const audioBuffer = await tempCtx.decodeAudioData(fileData);

    if (isCancelled(seqId)) return;

    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const totalSamples = audioBuffer.length;
    const duration = audioBuffer.duration;

    sendTelemetry('decode:decoded', {
      sampleRate,
      channels,
      totalSamples,
      duration,
      decodeMs: performance.now() - startTime,
    });

    sendProgress(seqId, 50, 0);

    // Extract PCM data and send in chunks
    // Chunk size: 1 second of audio (for streaming to analysis)
    const chunkSamples = sampleRate;
    const numChunks = Math.ceil(totalSamples / chunkSamples);

    // Interleave channels into mono for analysis
    // Keep original channels available for playback
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < channels; ch++) {
      channelData.push(audioBuffer.getChannelData(ch));
    }

    for (let i = 0; i < numChunks; i++) {
      if (isCancelled(seqId)) return;

      const start = i * chunkSamples;
      const end = Math.min(start + chunkSamples, totalSamples);
      const length = end - start;

      // Mix down to mono
      const monoChunk = new Float32Array(length);
      for (let s = 0; s < length; s++) {
        let sum = 0;
        for (let ch = 0; ch < channels; ch++) {
          sum += channelData[ch][start + s];
        }
        monoChunk[s] = sum / channels;
      }

      sendChunk(seqId, monoChunk, sampleRate, 1, i);

      const progress = 50 + ((i + 1) / numChunks) * 50;
      sendProgress(seqId, progress, end);
    }

    if (isCancelled(seqId)) return;

    sendComplete(seqId, totalSamples, sampleRate, channels, duration);

    sendTelemetry('decode:finish', {
      totalMs: performance.now() - startTime,
      totalSamples,
      throughputSamplesPerSec: totalSamples / ((performance.now() - startTime) / 1000),
    });
  } catch (err) {
    sendError(seqId, err instanceof Error ? err.message : String(err));
    sendTelemetry('decode:error', { error: String(err) });
  }
}

// ─── Message Handler ────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<DecodeWorkerInbound>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'decode:start':
      // Don't clear previous cancellations — they stay valid
      decodeAudio(msg.seqId, msg.fileData, msg.fileName);
      break;

    case 'cancel':
      cancelledSeqIds.add(msg.seqId);
      sendTelemetry('decode:cancelled', { seqId: msg.seqId });
      break;
  }
};
