import { getStorageRepository } from '../storage/repository';
import { EventLogEntry, ReplayCheckpoint } from '../types';
import { hashString } from '../utils/prng';

export const DEFAULT_REPLAY_STREAM = 'agros-replay-suite';
const GENESIS_REPLAY_CHECKSUM = 'genesis';

interface ReplayCheckSnapshot {
  name: string;
  stable: boolean;
  checksum?: string;
  details: Record<string, unknown>;
}

export interface ReplaySuiteSnapshot {
  stable: boolean;
  checks: ReplayCheckSnapshot[];
}

export interface ReplayHistoryVerification {
  stable: boolean;
  stream: string;
  eventCount: number;
  checkpointCount: number;
  latestChecksum: string;
  latestCheckpointId?: string;
  failures: string[];
}

export interface ReplayPersistenceResult {
  stream: string;
  appendedEvents: EventLogEntry[];
  checkpoint: ReplayCheckpoint;
  verification: ReplayHistoryVerification;
}

export interface ReplayHistoryResult {
  stream: string;
  events: EventLogEntry[];
  checkpoints: ReplayCheckpoint[];
  verification: ReplayHistoryVerification;
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        normalized[key] = stableNormalize((value as Record<string, unknown>)[key]);
        return normalized;
      }, {});
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

function createEventChecksum(
  stream: string,
  sequence: number,
  type: string,
  payload: Record<string, unknown>,
  previousChecksum: string,
): string {
  return hashString(stableStringify({
    payload,
    previousChecksum,
    sequence,
    stream,
    type,
  }));
}

function createReplayEvent(
  stream: string,
  sequence: number,
  check: ReplayCheckSnapshot,
  previousChecksum: string,
): EventLogEntry {
  const payload = {
    checksum: check.checksum ?? null,
    details: check.details,
    name: check.name,
    stable: check.stable,
  };
  const replayChecksum = createEventChecksum(
    stream,
    sequence,
    `replay.${check.name}`,
    payload,
    previousChecksum,
  );

  return {
    id: `event_${hashString(stableStringify({ replayChecksum, sequence, stream }))}`,
    stream,
    type: `replay.${check.name}`,
    sequence,
    payload,
    replayChecksum,
    createdAt: Date.now(),
  };
}

export async function persistReplaySuiteResult(
  result: ReplaySuiteSnapshot,
  stream = DEFAULT_REPLAY_STREAM,
): Promise<ReplayPersistenceResult> {
  const repository = getStorageRepository();
  const existingEvents = await repository.events.getByStream(stream);
  let previousChecksum = existingEvents.at(-1)?.replayChecksum ?? GENESIS_REPLAY_CHECKSUM;
  const appendedEvents: EventLogEntry[] = [];

  for (const check of result.checks) {
    const event = createReplayEvent(
      stream,
      existingEvents.length + appendedEvents.length + 1,
      check,
      previousChecksum,
    );
    const stored = await repository.events.append(event);
    appendedEvents.push(stored);
    previousChecksum = stored.replayChecksum;
  }

  const eventCount = existingEvents.length + appendedEvents.length;
  const state = {
    appendedEventCount: appendedEvents.length,
    checkCount: result.checks.length,
    checks: result.checks.map(check => ({
      checksum: check.checksum ?? null,
      name: check.name,
      stable: check.stable,
    })),
    stable: result.stable,
  };
  const checkpoint = await repository.replayCheckpoints.save({
    id: `checkpoint_${hashString(stableStringify({ eventCount, previousChecksum, stream }))}`,
    stream,
    label: result.stable ? 'replay_stable' : 'replay_degraded',
    eventCount,
    replayChecksum: previousChecksum,
    state,
  });

  return {
    stream,
    appendedEvents,
    checkpoint,
    verification: await verifyReplayHistory(stream),
  };
}

export async function verifyReplayHistory(stream = DEFAULT_REPLAY_STREAM): Promise<ReplayHistoryVerification> {
  const repository = getStorageRepository();
  const events = await repository.events.getByStream(stream);
  const checkpoints = await repository.replayCheckpoints.getLatest(stream);
  const failures: string[] = [];
  let previousChecksum = GENESIS_REPLAY_CHECKSUM;

  events.forEach((event, index) => {
    const expectedSequence = index + 1;
    if (event.sequence !== expectedSequence) {
      failures.push(`event ${event.id} sequence ${event.sequence} != ${expectedSequence}`);
    }
    const expectedChecksum = createEventChecksum(
      event.stream,
      event.sequence,
      event.type,
      event.payload,
      previousChecksum,
    );
    if (event.replayChecksum !== expectedChecksum) {
      failures.push(`event ${event.id} checksum mismatch`);
    }
    previousChecksum = event.replayChecksum;
  });

  const latestCheckpoint = checkpoints[0];
  if (latestCheckpoint) {
    if (latestCheckpoint.eventCount !== events.length) {
      failures.push(`checkpoint ${latestCheckpoint.id} event count mismatch`);
    }
    if (latestCheckpoint.replayChecksum !== previousChecksum) {
      failures.push(`checkpoint ${latestCheckpoint.id} checksum mismatch`);
    }
  } else if (events.length > 0) {
    failures.push('event stream has no replay checkpoint');
  }

  return {
    stable: failures.length === 0,
    stream,
    eventCount: events.length,
    checkpointCount: checkpoints.length,
    latestChecksum: previousChecksum,
    latestCheckpointId: latestCheckpoint?.id,
    failures,
  };
}

export async function getReplayHistory(
  stream = DEFAULT_REPLAY_STREAM,
  limit = 50,
): Promise<ReplayHistoryResult> {
  const repository = getStorageRepository();
  return {
    stream,
    events: await repository.events.getByStream(stream, limit),
    checkpoints: await repository.replayCheckpoints.getLatest(stream, limit),
    verification: await verifyReplayHistory(stream),
  };
}
