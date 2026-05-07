import React, { useEffect, useState } from 'react';
import { useBackend } from '../hooks/useBackend';
import { ReleaseEvidenceRecord, ReleaseGateReport, ReleaseReadinessReport } from '../lib/types';

const DEFAULT_STREAM = 'agros-replay-suite';
const DEFAULT_PROVIDER = 'local-docker';

export const ReleaseReadinessPanel: React.FC = () => {
  const [stream, setStream] = useState(DEFAULT_STREAM);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [release, setRelease] = useState<ReleaseReadinessReport | null>(null);
  const [evidenceHistory, setEvidenceHistory] = useState<ReleaseEvidenceRecord[]>([]);
  const [evidenceExportId, setEvidenceExportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    getReleaseEvidenceExport,
    getReleaseEvidenceHistory,
    getReleaseReadiness,
    loading,
  } = useBackend({ onError: setError });

  const loadReleaseReadiness = async () => {
    setError(null);
    setEvidenceExportId(null);
    const data = await getReleaseReadiness({
      stream,
      provider,
      includeRollbackPreflight: true,
    }) as any;
    if (data?.release) setRelease(data.release);
    const history = await getReleaseEvidenceHistory({ stream, limit: 4 }) as any;
    if (history?.evidence) setEvidenceHistory(history.evidence);
  };

  const exportReleaseEvidence = async () => {
    setError(null);
    const data = await getReleaseEvidenceExport({
      stream,
      provider,
      includeRollbackPreflight: true,
      limit: 8,
    }) as any;
    if (!data?.export) return;
    setEvidenceExportId(data.export.id);
    setRelease(data.export.release);
    setEvidenceHistory(data.export.history || []);
    downloadJson(`agros-release-evidence-${data.export.id}.json`, data.export);
  };

  useEffect(() => {
    loadReleaseReadiness();
  }, []);

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 6 }}>Phase 8 Release Evidence</h2>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            Runtime gates, replay alerts, rollback preflight, and provider-tagged release evidence.
          </div>
        </div>
        <StatusBadge status={release?.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10, marginBottom: 18 }}>
        <input
          value={stream}
          onChange={event => setStream(event.target.value)}
          placeholder="Replay stream"
          style={inputStyle}
        />
        <select value={provider} onChange={event => setProvider(event.target.value)} style={inputStyle}>
          <option value="local-docker">local-docker</option>
          <option value="railway">railway</option>
          <option value="render">render</option>
          <option value="custom">custom</option>
        </select>
        <button onClick={loadReleaseReadiness} disabled={loading || !stream.trim()} style={buttonStyle(loading || !stream.trim())}>
          Check Gate
        </button>
        <button onClick={exportReleaseEvidence} disabled={loading || !stream.trim()} style={buttonStyle(loading || !stream.trim())}>
          Export JSON
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
            Provider: {release.provider} | Snapshot: {release.latestMonitorSnapshot?.id || 'none'} | Alert: {release.latestAlertSnapshot?.id || 'none'}
          </div>
          <div style={{ marginTop: 6, color: statusColor(release.rollbackPreflight.status), fontSize: 11 }}>
            Rollback preflight: {release.rollbackPreflight.status} - {release.rollbackPreflight.detail}
          </div>
        </div>
      )}

      {evidenceExportId && (
        <div style={{ color: '#67E8F9', fontSize: 11, marginTop: 10 }}>
          Exported release evidence bundle {evidenceExportId}.
        </div>
      )}

      {evidenceHistory.length > 0 && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          <div style={panelTitleStyle}>Evidence History</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {evidenceHistory.map(item => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, color: '#CBD5E1', fontSize: 11 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.id}</span>
                <span style={{ color: statusColor(item.status), fontWeight: 700 }}>{item.status}</span>
                <span style={{ color: '#64748B' }}>{item.provider}</span>
              </div>
            ))}
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

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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
