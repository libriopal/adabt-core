import { continuityHub, ContinuityEvent } from './continuityHub';
import { DEFAULT_REPLAY_STREAM, getReplayHistory, stableStringify, verifyReplayHistory } from './replayHistory';
import { getStorageRepository } from '../storage/repository';
import { ReplayCheckpoint } from '../types';
import { hashString } from '../utils/prng';

export interface ContinuityExportOptions {
  stream?: string;
  checkpointId?: string;
  limit?: number;
}

export interface ContinuityExportBundle {
  version: 'agros-continuity-export-v1';
  exportedAt: number;
  stream: string;
  anchor: ReplayCheckpoint | null;
  replay: Awaited<ReturnType<typeof getReplayHistory>>;
  continuity: {
    interruptedRuns: string[];
    connectedClients: number;
    events: ContinuityEvent[];
  };
  verification: Awaited<ReturnType<typeof verifyReplayHistory>>;
  exportChecksum: string;
}

async function resolveAnchor(
  stream: string,
  checkpointId?: string,
): Promise<ReplayCheckpoint | null> {
  const repository = getStorageRepository();

  if (checkpointId) {
    const checkpoint = await repository.replayCheckpoints.getById(checkpointId);
    if (!checkpoint) {
      throw new Error(`Replay checkpoint not found: ${checkpointId}`);
    }
    if (checkpoint.stream !== stream) {
      throw new Error(`Replay checkpoint ${checkpointId} belongs to stream ${checkpoint.stream}`);
    }
    return checkpoint;
  }

  return (await repository.replayCheckpoints.getLatest(stream, 1))[0] ?? null;
}

export async function createContinuityExport(
  options: ContinuityExportOptions = {},
): Promise<ContinuityExportBundle> {
  const stream = options.stream ?? DEFAULT_REPLAY_STREAM;
  const limit = options.limit ?? 50;
  const anchor = await resolveAnchor(stream, options.checkpointId);
  const replay = await getReplayHistory(stream, limit);
  const verification = await verifyReplayHistory(stream);
  const continuity = continuityHub.getStatus();
  const exportedAt = Date.now();
  const checksumPayload = {
    anchorChecksum: anchor?.replayChecksum ?? null,
    anchorId: anchor?.id ?? null,
    eventCount: replay.events.length,
    exportedAt,
    interruptedRuns: continuity.interruptedRuns,
    stream,
  };

  return {
    version: 'agros-continuity-export-v1',
    exportedAt,
    stream,
    anchor,
    replay,
    continuity: {
      interruptedRuns: continuity.interruptedRuns,
      connectedClients: continuity.connectedClients,
      events: continuity.recentEvents.slice(-limit),
    },
    verification,
    exportChecksum: hashString(stableStringify(checksumPayload)),
  };
}
