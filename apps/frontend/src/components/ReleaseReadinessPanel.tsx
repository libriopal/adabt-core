import React, { useEffect, useState } from 'react';
import { useBackend } from '../hooks/useBackend';
import { ReleaseGateReport, ReleaseReadinessReport } from '../lib/types';

const DEFAULT_STREAM = 'agros-replay-suite';

export const ReleaseReadinessPanel: React.FC = () => {
  const [stream, setStream] = useState(DEFAULT_STREAM);
  const [release, setRelease] = useState<ReleaseReadinessReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getReleaseReadiness, loading } = useBackend({ onError: setError });

  const loadReleaseReadiness = async () => {
    setError(null);
    const data = await getReleaseReadiness({ stream }) as any;
    if (data?.release) setRelease(data.release);
  };

  useEffect(() => {
    loadReleaseReadiness();
  }, []);

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 6 }}>Phase 7 Release Gate</h2>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            Runtime, replay monitor, and alert acknowledgement gates for go/no-go release decisions.
          </div>
        </div>
        <StatusBadge status={release?.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 138px', gap: 10, marginBottom: 18 }}>
        <input
          value={stream}
          onChange={event => setStream(event.target.value)}
          placeholder="Replay stream"
          style={inputStyle}
        />
        <button onClick={loadReleaseReadiness} disabled={loading || !stream.trim()} style={buttonStyle(loading || !stream.trim())}>
          Check Gate
        </button>
      </div>

      {error && (
        <div style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)', borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 10, marginBottom: 14 }}>
        {(release?.gates || []).map(gate => (
          <GateCard key={gate.name} gate={gate} />
        ))}
        {!release && (
          <div style={{ color: '#64748B', fontSize: 12 }}>Release gate has not been checked yet.</div>
        )}
      </div>

      {release && (
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Release Guidance</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {release.recommendations.map(recommendation => (
              <div key={recommendation} style={{ color: release.status === 'ready' ? '#A3E635' : '#FDBA74', fontSize: 12 }}>
                {recommendation}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, color: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            Snapshot: {release.latestMonitorSnapshot?.id || 'none'} | Alert: {release.latestAlertSnapshot?.id || 'none'}
          </div>
        </div>
      )}
    </div>
  );
};

const GateCard: React.FC<{ gate: ReleaseGateReport }> = ({ gate }) => {
  const color = statusColor(gate.status);
  return (
    <div style={{ background: '#0A0E1A', borderRadius: 6, padding: 12, border: `1px solid ${color}`, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0 }}>{gate.name.replace(/_/g, ' ')}</div>
        <div style={{ color, fontSize: 10, fontWeight: 800 }}>{gate.status}</div>
      </div>
      <div style={{ color: '#CBD5E1', fontSize: 12, lineHeight: 1.35 }}>{gate.detail}</div>
    </div>
  );
};

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const color = statusColor(status);
  return (
    <div style={{ color, background: `${color}22`, border: `1px solid ${color}`, borderRadius: 4, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
      {status || 'pending'}
    </div>
  );
};

function statusColor(status?: string): string {
  if (status === 'ready') return '#10B981';
  if (status === 'blocked') return '#EF4444';
  if (status === 'degraded') return '#F59E0B';
  return '#64748B';
}

const inputStyle: React.CSSProperties = {
  background: '#0A0E1A',
  border: '1px solid #1E293B',
  borderRadius: 6,
  color: '#E2E8F0',
  padding: '9px 10px',
  fontSize: 12,
  minWidth: 0,
};

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

function buttonStyle(disabled?: boolean): React.CSSProperties {
  return {
    background: disabled ? '#1E293B' : '#22D3EE',
    border: 'none',
    borderRadius: 6,
    color: disabled ? '#64748B' : '#0A0E1A',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 12,
    fontWeight: 800,
    minHeight: 37,
  };
}
