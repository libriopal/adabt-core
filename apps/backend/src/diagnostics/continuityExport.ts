import { continuityHub, ContinuityEvent } from './continuityHub';
import {
  DEFAULT_REPLAY_STREAM,
  getReplayHistory,
  getReplayMonitorHistory,
  monitorReplayHistory,
  stableStringify,
  verifyReplayHistory,
} from './replayHistory';
import { getStorageRepository } from '../storage/repository';
import { ReplayCheckpoint, ReplayMonitorSnapshot } from '../types';
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

export interface DegradedReplayExportBundle {
  version: 'agros-degraded-replay-export-v1';
  exportedAt: number;
  stream: string;
  monitor: Awaited<ReturnType<typeof monitorReplayHistory>>;
  monitorSnapshot: ReplayMonitorSnapshot | null;
  continuityExport: ContinuityExportBundle;
  recommendations: string[];
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

function replayRecoveryRecommendations(
  monitor: Awaited<ReturnType<typeof monitorReplayHistory>>,
  snapshot: ReplayMonitorSnapshot | null,
): string[] {
  const recommendations = new Set<string>();

  if (monitor.alerts.length === 0) {
    recommendations.add('Continue scheduled replay monitor snapshots and retain the latest continuity export.');
  }
  if (monitor.verification.failures.length > 0) {
    recommendations.add('Run recovery verification with /api/replay/verify?persist=false before appending new replay events.');
    recommendations.add('Compare the last stable checkpoint against the degraded checkpoint with /api/replay/checkpoints/diff.');
  }
  if (monitor.latestDiff?.degradedChecks.length) {
    recommendations.add(`Inspect degraded replay checks: ${monitor.latestDiff.degradedChecks.join(', ')}.`);
  }
  if (!monitor.latestCheckpoint) {
    recommendations.add('Create a fresh checkpoint with /api/replay/verify after confirming repository storage is healthy.');
  }
  if (snapshot && !snapshot.acknowledgedAt && snapshot.alertCount > 0) {
    recommendations.add(`Acknowledge monitor snapshot ${snapshot.id} after the recovery owner accepts the alert.`);
  }
  recommendations.add('Attach this degraded replay export to the incident or deployment rollback record.');

  return Array.from(recommendations);
}

export async function createDegradedReplayExport(
  options: ContinuityExportOptions & { snapshotId?: string } = {},
): Promise<DegradedReplayExportBundle> {
  const stream = options.stream ?? DEFAULT_REPLAY_STREAM;
  const monitor = await monitorReplayHistory(stream);
  const snapshots = await getReplayMonitorHistory(stream, 50);
  const monitorSnapshot = options.snapshotId
    ? snapshots.find(snapshot => snapshot.id === options.snapshotId) ?? null
    : snapshots.find(snapshot => snapshot.id === monitor.snapshotId) ?? snapshots[0] ?? null;
  const continuityExport = await createContinuityExport(options);
  const exportedAt = Date.now();
  const recommendations = replayRecoveryRecommendations(monitor, monitorSnapshot);

  return {
    version: 'agros-degraded-replay-export-v1',
    exportedAt,
    stream,
    monitor,
    monitorSnapshot,
    continuityExport,
    recommendations,
    exportChecksum: hashString(stableStringify({
      continuityChecksum: continuityExport.exportChecksum,
      exportedAt,
      monitorSnapshotId: monitorSnapshot?.id ?? null,
      recommendations,
      status: monitor.status,
      stream,
    })),
  };
}
