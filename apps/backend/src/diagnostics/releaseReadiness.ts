import { ReplayMonitorSnapshot } from '../types';
import { DEFAULT_REPLAY_STREAM, getReplayMonitorHistory, monitorReplayHistory } from './replayHistory';
import { RuntimeValidationReport, validateRuntimeEnvironment } from './runtimeValidation';

export type ReleaseGateStatus = 'ready' | 'degraded' | 'blocked';

export interface ReleaseGateReport {
  name: string;
  status: ReleaseGateStatus;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface ReleaseReadinessReport {
  status: ReleaseGateStatus;
  checkedAt: number;
  stream: string;
  runtime: RuntimeValidationReport;
  replayMonitor: Awaited<ReturnType<typeof monitorReplayHistory>>;
  latestMonitorSnapshot?: ReplayMonitorSnapshot;
  latestAlertSnapshot?: ReplayMonitorSnapshot;
  latestAcknowledgedAlertSnapshot?: ReplayMonitorSnapshot;
  gates: ReleaseGateReport[];
  recommendations: string[];
}

export interface ReleaseReadinessOptions {
  stream?: string;
  persistMonitor?: boolean;
}

function summarizeRuntimeGate(runtime: RuntimeValidationReport): ReleaseGateReport {
  return {
    name: 'runtime',
    status: runtime.status === 'ready' ? 'ready' : 'degraded',
    detail: runtime.warnings.length ? runtime.warnings.join('; ') : 'runtime environment is ready',
    evidence: {
      databaseProvider: runtime.config.databaseProvider,
      workersEnabled: runtime.config.workersEnabled,
      queueMode: runtime.config.queueMode,
    },
  };
}

function summarizeReplayGate(
  replayMonitor: Awaited<ReturnType<typeof monitorReplayHistory>>,
): ReleaseGateReport {
  return {
    name: 'replay_monitor',
    status: replayMonitor.status === 'ready' ? 'ready' : 'degraded',
    detail: replayMonitor.alerts.length ? replayMonitor.alerts.join('; ') : 'replay monitor is ready',
    evidence: {
      eventCount: replayMonitor.verification.eventCount,
      checkpointCount: replayMonitor.verification.checkpointCount,
      latestCheckpointId: replayMonitor.verification.latestCheckpointId,
      snapshotId: replayMonitor.snapshotId,
    },
  };
}

function summarizeAcknowledgementGate(
  latestAlertSnapshot?: ReplayMonitorSnapshot,
  latestAcknowledgedAlertSnapshot?: ReplayMonitorSnapshot,
): ReleaseGateReport {
  if (!latestAlertSnapshot) {
    return {
      name: 'alert_acknowledgement',
      status: 'ready',
      detail: 'no replay monitor alerts require acknowledgement',
    };
  }

  if (!latestAlertSnapshot.acknowledgedAt) {
    return {
      name: 'alert_acknowledgement',
      status: 'blocked',
      detail: `latest replay alert snapshot ${latestAlertSnapshot.id} is not acknowledged`,
      evidence: {
        alertCount: latestAlertSnapshot.alertCount,
        alerts: latestAlertSnapshot.alerts,
        snapshotId: latestAlertSnapshot.id,
      },
    };
  }

  return {
    name: 'alert_acknowledgement',
    status: 'ready',
    detail: `latest replay alert acknowledged by ${latestAlertSnapshot.acknowledgedBy ?? 'operator'}`,
    evidence: {
      acknowledgedAt: latestAlertSnapshot.acknowledgedAt,
      acknowledgedBy: latestAlertSnapshot.acknowledgedBy,
      latestAcknowledgedSnapshotId: latestAcknowledgedAlertSnapshot?.id,
      snapshotId: latestAlertSnapshot.id,
    },
  };
}

function releaseStatus(gates: ReleaseGateReport[]): ReleaseGateStatus {
  if (gates.some(gate => gate.status === 'blocked')) return 'blocked';
  if (gates.some(gate => gate.status === 'degraded')) return 'degraded';
  return 'ready';
}

function releaseRecommendations(
  status: ReleaseGateStatus,
  gates: ReleaseGateReport[],
): string[] {
  const recommendations = new Set<string>();

  if (status === 'ready') {
    recommendations.add('Proceed with release after recording this readiness report.');
  }

  for (const gate of gates) {
    if (gate.name === 'runtime' && gate.status !== 'ready') {
      recommendations.add('Resolve runtime warnings before release or record an explicit operator exception.');
    }
    if (gate.name === 'replay_monitor' && gate.status !== 'ready') {
      recommendations.add('Run recovery verification and checkpoint diff before release.');
    }
    if (gate.name === 'alert_acknowledgement' && gate.status === 'blocked') {
      recommendations.add('Acknowledge or resolve the latest replay alert snapshot before release.');
    }
  }

  if (status !== 'ready') {
    recommendations.add('Block automated release promotion until every gate is ready or explicitly accepted.');
  }

  return Array.from(recommendations);
}

export async function collectReleaseReadiness(
  options: ReleaseReadinessOptions = {},
): Promise<ReleaseReadinessReport> {
  const stream = options.stream ?? DEFAULT_REPLAY_STREAM;
  const runtime = validateRuntimeEnvironment();
  const replayMonitor = await monitorReplayHistory(stream, { persist: options.persistMonitor });
  const snapshots = await getReplayMonitorHistory(stream, 20);
  const latestMonitorSnapshot = replayMonitor.snapshotId
    ? snapshots.find(snapshot => snapshot.id === replayMonitor.snapshotId) ?? snapshots[0]
    : snapshots[0];
  const latestAlertSnapshot = snapshots.find(snapshot => snapshot.alertCount > 0);
  const latestAcknowledgedAlertSnapshot = snapshots.find(snapshot => (
    snapshot.alertCount > 0 && Boolean(snapshot.acknowledgedAt)
  ));
  const gates = [
    summarizeRuntimeGate(runtime),
    summarizeReplayGate(replayMonitor),
    summarizeAcknowledgementGate(latestAlertSnapshot, latestAcknowledgedAlertSnapshot),
  ];
  const status = releaseStatus(gates);

  return {
    status,
    checkedAt: Date.now(),
    stream,
    runtime,
    replayMonitor,
    latestMonitorSnapshot,
    latestAlertSnapshot,
    latestAcknowledgedAlertSnapshot,
    gates,
    recommendations: releaseRecommendations(status, gates),
  };
}
