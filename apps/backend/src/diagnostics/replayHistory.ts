import { getStorageRepository } from '../storage/repository';
import { EventLogEntry, ReplayCheckpoint, ReplayMonitorSnapshot } from '../types';
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

export interface ReplayCheckpointDiff {
  stream: string;
  base: ReplayCheckpoint;
  target: ReplayCheckpoint;
  eventDelta: number;
  checksumChanged: boolean;
  stateStable: boolean;
  checkDeltas: Array<{
    name: string;
    baseStable?: boolean;
    targetStable?: boolean;
    baseChecksum?: string | null;
    targetChecksum?: string | null;
    changed: boolean;
  }>;
  degradedChecks: string[];
}

export interface ReplayHistoryMonitorReport {
  status: 'ready' | 'degraded';
  stream: string;
  checkedAt: number;
  snapshotId?: string;
  verification: ReplayHistoryVerification;
  latestCheckpoint?: ReplayCheckpoint;
  previousCheckpoint?: ReplayCheckpoint;
  latestDiff?: ReplayCheckpointDiff;
  alerts: string[];
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

export interface ReplayMonitorOptions {
  persist?: boolean;
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

function checkpointChecks(checkpoint: ReplayCheckpoint): Array<{
  name: string;
  stable?: boolean;
  checksum?: string | null;
}> {
  const checks = (checkpoint.state as { checks?: unknown }).checks;
  return Array.isArray(checks)
    ? checks.filter((check): check is { name: string; stable?: boolean; checksum?: string | null } => (
      typeof check === 'object' && check !== null && typeof (check as { name?: unknown }).name === 'string'
    ))
    : [];
}

export async function diffReplayCheckpoints(
  baseId: string,
  targetId: string,
  stream = DEFAULT_REPLAY_STREAM,
): Promise<ReplayCheckpointDiff> {
  const repository = getStorageRepository();
  const [base, target] = await Promise.all([
    repository.replayCheckpoints.getById(baseId),
    repository.replayCheckpoints.getById(targetId),
  ]);

  if (!base) throw new Error(`Replay checkpoint not found: ${baseId}`);
  if (!target) throw new Error(`Replay checkpoint not found: ${targetId}`);
  if (base.stream !== stream) throw new Error(`Replay checkpoint ${base.id} belongs to stream ${base.stream}`);
  if (target.stream !== stream) throw new Error(`Replay checkpoint ${target.id} belongs to stream ${target.stream}`);

  const baseChecks = new Map(checkpointChecks(base).map(check => [check.name, check]));
  const targetChecks = new Map(checkpointChecks(target).map(check => [check.name, check]));
  const names = Array.from(new Set([...baseChecks.keys(), ...targetChecks.keys()])).sort();
  const checkDeltas = names.map(name => {
    const baseCheck = baseChecks.get(name);
    const targetCheck = targetChecks.get(name);
    const baseChecksum = baseCheck?.checksum ?? null;
    const targetChecksum = targetCheck?.checksum ?? null;
    const changed = baseCheck?.stable !== targetCheck?.stable || baseChecksum !== targetChecksum;
    return {
      name,
      baseStable: baseCheck?.stable,
      targetStable: targetCheck?.stable,
      baseChecksum,
      targetChecksum,
      changed,
    };
  });

  return {
    stream,
    base,
    target,
    eventDelta: target.eventCount - base.eventCount,
    checksumChanged: base.replayChecksum !== target.replayChecksum,
    stateStable: Boolean((base.state as { stable?: unknown }).stable)
      && Boolean((target.state as { stable?: unknown }).stable),
    checkDeltas,
    degradedChecks: checkDeltas
      .filter(delta => delta.targetStable === false)
      .map(delta => delta.name),
  };
}

export async function monitorReplayHistory(
  stream = DEFAULT_REPLAY_STREAM,
  options: ReplayMonitorOptions = {},
): Promise<ReplayHistoryMonitorReport> {
  const repository = getStorageRepository();
  const [verification, checkpoints] = await Promise.all([
    verifyReplayHistory(stream),
    repository.replayCheckpoints.getLatest(stream, 2),
  ]);
  const [latestCheckpoint, previousCheckpoint] = checkpoints;
  const alerts: string[] = [];

  if (!verification.stable) {
    alerts.push(...verification.failures);
  }
  if (!latestCheckpoint) {
    alerts.push('no replay checkpoint is available');
  }
  if (latestCheckpoint && !Boolean((latestCheckpoint.state as { stable?: unknown }).stable)) {
    alerts.push(`latest checkpoint ${latestCheckpoint.id} is degraded`);
  }

  let latestDiff: ReplayCheckpointDiff | undefined;
  if (latestCheckpoint && previousCheckpoint) {
    latestDiff = await diffReplayCheckpoints(previousCheckpoint.id, latestCheckpoint.id, stream);
    if (latestDiff.degradedChecks.length > 0) {
      alerts.push(`degraded checks: ${latestDiff.degradedChecks.join(', ')}`);
    }
  }

  const checkedAt = Date.now();
  const report: ReplayHistoryMonitorReport = {
    status: alerts.length === 0 ? 'ready' : 'degraded',
    stream,
    checkedAt,
    verification,
    latestCheckpoint,
    previousCheckpoint,
    latestDiff,
    alerts,
  };

  if (options.persist !== false) {
    const snapshot = await repository.replayMonitorSnapshots.save({
      id: `monitor_${hashString(stableStringify({
        alerts,
        checkedAt,
        checkpoint: verification.latestCheckpointId ?? null,
        eventCount: verification.eventCount,
        status: report.status,
        stream,
      }))}`,
      stream,
      status: report.status,
      checkedAt,
      eventCount: verification.eventCount,
      checkpointCount: verification.checkpointCount,
      latestCheckpointId: verification.latestCheckpointId,
      alertCount: alerts.length,
      alerts,
      report: report as unknown as Record<string, unknown>,
    });
    report.snapshotId = snapshot.id;
  }

  return report;
}

export async function getReplayMonitorHistory(
  stream = DEFAULT_REPLAY_STREAM,
  limit = 20,
): Promise<ReplayMonitorSnapshot[]> {
  return getStorageRepository().replayMonitorSnapshots.getLatest(stream, limit);
}

export async function acknowledgeReplayMonitorSnapshot(
  snapshotId: string,
  acknowledgedBy = 'operator',
): Promise<ReplayMonitorSnapshot> {
  const snapshot = await getStorageRepository().replayMonitorSnapshots.acknowledge(snapshotId, acknowledgedBy);
  if (!snapshot) throw new Error(`Replay monitor snapshot not found: ${snapshotId}`);
  return snapshot;
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
