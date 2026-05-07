import React, { useEffect, useMemo, useState } from 'react';
import { useBackend } from '../hooks/useBackend';
import {
  ContinuityExportBundle,
  DegradedReplayExportBundle,
  EventLogEntry,
  ReplayCheckpoint,
  ReplayCheckpointDiff,
  ReplayHistoryMonitorReport,
  ReplayHistoryResult,
  ReplayMonitorSnapshot,
} from '../lib/types';

const DEFAULT_STREAM = 'agros-replay-suite';

export const ReplayOperationsPanel: React.FC = () => {
  const [stream, setStream] = useState(DEFAULT_STREAM);
  const [limit, setLimit] = useState(20);
  const [history, setHistory] = useState<ReplayHistoryResult | null>(null);
  const [baseId, setBaseId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [serverDiff, setServerDiff] = useState<ReplayCheckpointDiff | null>(null);
  const [monitor, setMonitor] = useState<ReplayHistoryMonitorReport | null>(null);
  const [monitorHistory, setMonitorHistory] = useState<ReplayMonitorSnapshot[]>([]);
  const [continuityExport, setContinuityExport] = useState<ContinuityExportBundle | null>(null);
  const [degradedExport, setDegradedExport] = useState<DegradedReplayExportBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    getReplayHistory,
    getReplayMonitor,
    getReplayMonitorHistory,
    acknowledgeReplayMonitor,
    getReplayCheckpointDiff,
    getContinuityExport,
    getDegradedReplayExport,
    runReplayVerify,
    loading,
  } = useBackend({ onError: setError });

  const loadHistory = async () => {
    setError(null);
    const [data, monitorData, monitorHistoryData] = await Promise.all([
      getReplayHistory({ stream, limit }) as any,
      getReplayMonitor({ stream }) as any,
      getReplayMonitorHistory({ stream, limit }) as any,
    ]);
    if (data?.history) {
      const nextHistory = data.history as ReplayHistoryResult;
      setHistory(nextHistory);
      setBaseId(current => (
        nextHistory.checkpoints.some(checkpoint => checkpoint.id === current)
          ? current
          : nextHistory.checkpoints[1]?.id || nextHistory.checkpoints[0]?.id || ''
      ));
      setTargetId(current => (
        nextHistory.checkpoints.some(checkpoint => checkpoint.id === current)
          ? current
          : nextHistory.checkpoints[0]?.id || ''
      ));
    }
    if (monitorData?.monitor) setMonitor(monitorData.monitor);
    if (monitorHistoryData?.snapshots) setMonitorHistory(monitorHistoryData.snapshots);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const checkpointMap = useMemo(() => {
    return new Map((history?.checkpoints || []).map(checkpoint => [checkpoint.id, checkpoint]));
  }, [history]);
  const base = baseId ? checkpointMap.get(baseId) : undefined;
  const target = targetId ? checkpointMap.get(targetId) : undefined;
  const comparison = base && target ? compareCheckpoints(base, target) : null;

  const handleRunReplay = async () => {
    setError(null);
    await runReplayVerify({ persist: false });
    await loadHistory();
  };

  const handleAppendReplay = async () => {
    setError(null);
    await runReplayVerify();
    await loadHistory();
  };

  const handleCompare = async () => {
    if (!baseId || !targetId) return;
    setError(null);
    const data = await getReplayCheckpointDiff({ stream, baseId, targetId }) as any;
    if (data?.diff) setServerDiff(data.diff);
  };

  const handleExport = async () => {
    setError(null);
    const checkpointId = targetId || history?.verification.latestCheckpointId;
    const data = await getContinuityExport({ stream, checkpointId, limit }) as any;
    if (data?.export) setContinuityExport(data.export);
  };

  const handleDegradedExport = async () => {
    setError(null);
    const checkpointId = targetId || history?.verification.latestCheckpointId;
    const data = await getDegradedReplayExport({
      stream,
      checkpointId,
      limit,
      snapshotId: monitor?.snapshotId || monitorHistory[0]?.id,
    }) as any;
    if (data?.export) setDegradedExport(data.export);
  };

  const handleAcknowledgeMonitor = async () => {
    const snapshotId = monitor?.snapshotId || monitorHistory[0]?.id;
    if (!snapshotId) return;
    setError(null);
    await acknowledgeReplayMonitor(snapshotId, 'frontend-operator');
    await loadHistory();
  };

  const downloadJson = (payload: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  };

  const handleDownload = () => {
    if (!continuityExport) return;
    downloadJson(
      continuityExport,
      `${continuityExport.stream}-${continuityExport.anchor?.id || 'latest'}-continuity.json`,
    );
  };

  const handleDownloadDegraded = () => {
    if (!degradedExport) return;
    downloadJson(
      degradedExport,
      `${degradedExport.stream}-${degradedExport.monitorSnapshot?.id || 'latest'}-degraded-replay.json`,
    );
  };

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 6 }}>Phase 6 Replay Observability</h2>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            Persisted monitor trend, alert acknowledgement, degraded export bundles, and recovery guidance.
          </div>
        </div>
        <StatusBadge stable={monitor ? monitor.status === 'ready' : history?.verification.stable} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10, marginBottom: 18 }}>
        <input
          value={stream}
          onChange={event => setStream(event.target.value)}
          placeholder="Replay stream"
          style={inputStyle}
        />
        <input
          type="number"
          value={limit}
          min={1}
          max={500}
          onChange={event => setLimit(Number(event.target.value))}
          style={inputStyle}
        />
        <button onClick={loadHistory} disabled={loading || !stream.trim()} style={buttonStyle('#22D3EE', loading)}>
          Filter
        </button>
        <button onClick={handleRunReplay} disabled={loading} style={buttonStyle('#10B981', loading)}>
          Recovery Verify
        </button>
        <button onClick={handleAppendReplay} disabled={loading} style={buttonStyle('#6366F1', loading)}>
          Append Replay
        </button>
        <button onClick={handleExport} disabled={loading || !history?.checkpoints.length} style={buttonStyle('#F59E0B', loading || !history?.checkpoints.length)}>
          Export Anchor
        </button>
        <button onClick={handleDownload} disabled={!continuityExport} style={buttonStyle('#E2E8F0', !continuityExport)}>
          Download
        </button>
        <button onClick={handleDegradedExport} disabled={loading || !history?.checkpoints.length} style={buttonStyle('#F97316', loading || !history?.checkpoints.length)}>
          Degraded Export
        </button>
        <button onClick={handleAcknowledgeMonitor} disabled={loading || !(monitor?.snapshotId || monitorHistory[0]?.id)} style={buttonStyle('#A3E635', loading || !(monitor?.snapshotId || monitorHistory[0]?.id))}>
          Ack Monitor
        </button>
      </div>

      {error && (
        <div style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)', borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="Events" value={String(history?.verification.eventCount ?? '-')} color="#22D3EE" />
        <Metric label="Checkpoints" value={String(history?.verification.checkpointCount ?? '-')} color="#6366F1" />
        <Metric label="Latest" value={history?.verification.latestChecksum || '-'} color="#10B981" />
        <Metric label="Monitor" value={monitor?.status || '-'} color={monitor?.status === 'degraded' ? '#F59E0B' : '#10B981'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Replay Events</div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 238, overflowY: 'auto' }}>
            {(history?.events || []).map(event => (
              <EventRow key={event.id} event={event} />
            ))}
            {history?.events.length === 0 && (
              <div style={{ color: '#64748B', fontSize: 12 }}>No events for this stream yet.</div>
            )}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelTitleStyle}>Checkpoint Comparison</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <CheckpointSelect label="Base" value={baseId} onChange={setBaseId} checkpoints={history?.checkpoints || []} />
            <CheckpointSelect label="Target" value={targetId} onChange={setTargetId} checkpoints={history?.checkpoints || []} />
          </div>
          <button onClick={handleCompare} disabled={loading || !baseId || !targetId} style={{ ...buttonStyle('#22D3EE', loading || !baseId || !targetId), width: '100%', marginBottom: 12 }}>
            Server Diff
          </button>
          {comparison ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <Line label="Events" value={`${(serverDiff?.eventDelta ?? comparison.eventDelta) >= 0 ? '+' : ''}${serverDiff?.eventDelta ?? comparison.eventDelta}`} />
              <Line label="Checksum" value={(serverDiff?.checksumChanged ?? !comparison.sameChecksum) ? 'changed' : 'unchanged'} />
              <Line label="State" value={(serverDiff?.stateStable ?? comparison.stateStable) ? 'stable' : 'degraded'} />
              <Line label="Anchor" value={target?.id || '-'} />
              <Line label="Degraded" value={serverDiff?.degradedChecks.join(', ') || 'none'} />
            </div>
          ) : (
            <div style={{ color: '#64748B', fontSize: 12 }}>Select two checkpoints to compare.</div>
          )}
        </div>
      </div>

      {continuityExport && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          <div style={panelTitleStyle}>Continuity Export</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <Line label="Anchor" value={continuityExport.anchor?.id || 'none'} />
            <Line label="Events" value={String(continuityExport.continuity.events.length)} />
            <Line label="Checksum" value={continuityExport.exportChecksum} />
          </div>
        </div>
      )}

      {monitor && monitor.alerts.length > 0 && (
        <div style={{ ...panelStyle, marginTop: 12, borderColor: 'rgba(245,158,11,0.65)' }}>
          <div style={panelTitleStyle}>Replay Monitor Alerts</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {monitor.alerts.map(alert => (
              <div key={alert} style={{ color: '#F59E0B', fontSize: 12 }}>{alert}</div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...panelStyle, marginTop: 12 }}>
        <div style={panelTitleStyle}>Monitor History</div>
        <div style={{ display: 'grid', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
          {monitorHistory.map(snapshot => (
            <div key={snapshot.id} style={{ display: 'grid', gridTemplateColumns: '82px 74px 1fr 86px', gap: 8, color: '#94A3B8', fontSize: 11, alignItems: 'center' }}>
              <span style={{ color: snapshot.status === 'degraded' ? '#F59E0B' : '#10B981', fontWeight: 800 }}>{snapshot.status}</span>
              <span>{snapshot.alertCount} alerts</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'JetBrains Mono, monospace' }}>{snapshot.id}</span>
              <span style={{ color: snapshot.acknowledgedAt ? '#A3E635' : '#64748B' }}>
                {snapshot.acknowledgedAt ? 'acked' : 'open'}
              </span>
            </div>
          ))}
          {monitorHistory.length === 0 && (
            <div style={{ color: '#64748B', fontSize: 12 }}>No monitor snapshots persisted yet.</div>
          )}
        </div>
      </div>

      {degradedExport && (
        <div style={{ ...panelStyle, marginTop: 12, borderColor: 'rgba(249,115,22,0.65)' }}>
          <div style={panelTitleStyle}>Degraded Replay Export</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
            <Line label="Snapshot" value={degradedExport.monitorSnapshot?.id || 'none'} />
            <Line label="Status" value={degradedExport.monitor.status} />
            <Line label="Checksum" value={degradedExport.exportChecksum} />
          </div>
          <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
            {degradedExport.recommendations.map(recommendation => (
              <div key={recommendation} style={{ color: '#FDBA74', fontSize: 12 }}>{recommendation}</div>
            ))}
          </div>
          <button onClick={handleDownloadDegraded} style={{ ...buttonStyle('#FDBA74'), width: '100%' }}>
            Download Degraded Bundle
          </button>
        </div>
      )}
    </div>
  );
};

function compareCheckpoints(base: ReplayCheckpoint, target: ReplayCheckpoint) {
  const baseStable = Boolean((base.state as any)?.stable);
  const targetStable = Boolean((target.state as any)?.stable);
  return {
    eventDelta: target.eventCount - base.eventCount,
    sameChecksum: base.replayChecksum === target.replayChecksum,
    stateStable: baseStable && targetStable,
  };
}

const CheckpointSelect: React.FC<{
  label: string;
  value: string;
  checkpoints: ReplayCheckpoint[];
  onChange: (value: string) => void;
}> = ({ label, value, checkpoints, onChange }) => (
  <label style={{ display: 'grid', gap: 5, color: '#64748B', fontSize: 10 }}>
    {label}
    <select value={value} onChange={event => onChange(event.target.value)} style={inputStyle}>
      <option value="">none</option>
      {checkpoints.map(checkpoint => (
        <option key={checkpoint.id} value={checkpoint.id}>
          {checkpoint.id}
        </option>
      ))}
    </select>
  </label>
);

const EventRow: React.FC<{ event: EventLogEntry }> = ({ event }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr 84px', gap: 10, alignItems: 'center', color: '#94A3B8', fontSize: 11 }}>
    <span style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>#{event.sequence}</span>
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.type}</span>
    <span style={{ color: '#22D3EE', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {event.replayChecksum}
    </span>
  </div>
);

const StatusBadge: React.FC<{ stable?: boolean }> = ({ stable }) => {
  const color = stable ? '#10B981' : stable === false ? '#F59E0B' : '#64748B';
  return (
    <div style={{ color, background: `${color}22`, border: `1px solid ${color}`, borderRadius: 4, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
      {stable ? 'Verified' : stable === false ? 'Degraded' : 'Pending'}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#0A0E1A', borderRadius: 6, padding: 12, border: '1px solid #1E293B', minWidth: 0 }}>
    <div style={{ color: '#64748B', fontSize: 10, marginBottom: 5 }}>{label}</div>
    <div style={{ color, fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
  </div>
);

const Line: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8, color: '#94A3B8', fontSize: 12, minWidth: 0 }}>
    <span style={{ color: '#64748B' }}>{label}</span>
    <span style={{ fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
  </div>
);

const panelStyle: React.CSSProperties = {
  background: '#0A0E1A',
  borderRadius: 6,
  padding: 14,
  border: '1px solid #1E293B',
};

const panelTitleStyle: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: 11,
  marginBottom: 10,
  textTransform: 'uppercase',
  letterSpacing: 0,
};

const inputStyle: React.CSSProperties = {
  background: '#0A0E1A',
  border: '1px solid #1E293B',
  borderRadius: 6,
  color: '#E2E8F0',
  padding: '9px 10px',
  fontSize: 12,
  minWidth: 0,
};

function buttonStyle(color: string, disabled?: boolean): React.CSSProperties {
  return {
    background: disabled ? '#1E293B' : color,
    border: 'none',
    borderRadius: 6,
    color: disabled ? '#64748B' : '#0A0E1A',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 12,
    fontWeight: 800,
    minHeight: 37,
  };
}
