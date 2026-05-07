import React, { useEffect, useMemo, useState } from 'react';
import { useBackend } from '../hooks/useBackend';
import {
  ContinuityExportBundle,
  EventLogEntry,
  ReplayCheckpoint,
  ReplayHistoryResult,
} from '../lib/types';

const DEFAULT_STREAM = 'agros-replay-suite';

export const ReplayOperationsPanel: React.FC = () => {
  const [stream, setStream] = useState(DEFAULT_STREAM);
  const [limit, setLimit] = useState(20);
  const [history, setHistory] = useState<ReplayHistoryResult | null>(null);
  const [baseId, setBaseId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [continuityExport, setContinuityExport] = useState<ContinuityExportBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getReplayHistory, getContinuityExport, runReplayVerify, loading } = useBackend({ onError: setError });

  const loadHistory = async () => {
    setError(null);
    const data = await getReplayHistory({ stream, limit }) as any;
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
    await runReplayVerify();
    await loadHistory();
  };

  const handleExport = async () => {
    setError(null);
    const checkpointId = targetId || history?.verification.latestCheckpointId;
    const data = await getContinuityExport({ stream, checkpointId, limit }) as any;
    if (data?.export) setContinuityExport(data.export);
  };

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 6 }}>Phase 4 Replay Operations</h2>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            Replay history filters, checkpoint comparison, and continuity export anchors.
          </div>
        </div>
        <StatusBadge stable={history?.verification.stable} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 18 }}>
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
          Run Replay
        </button>
        <button onClick={handleExport} disabled={loading || !history?.checkpoints.length} style={buttonStyle('#F59E0B', loading || !history?.checkpoints.length)}>
          Export Anchor
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
        <Metric label="Export" value={continuityExport?.exportChecksum || '-'} color="#F59E0B" />
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
          {comparison ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <Line label="Events" value={`${comparison.eventDelta >= 0 ? '+' : ''}${comparison.eventDelta}`} />
              <Line label="Checksum" value={comparison.sameChecksum ? 'unchanged' : 'changed'} />
              <Line label="State" value={comparison.stateStable ? 'stable' : 'degraded'} />
              <Line label="Anchor" value={target?.id || '-'} />
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
            <Line label="Runs" value={String(continuityExport.continuity.interruptedRuns.length)} />
          </div>
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
