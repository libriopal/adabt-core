import React, { useEffect, useState } from 'react';
import { useBackend } from '../hooks/useBackend';
import { ReinforcementDecision, ReinforcementReplaySummary } from '../lib/types';

export const ReinforcementOptimizerPanel: React.FC = () => {
  const [replay, setReplay] = useState<ReinforcementReplaySummary | null>(null);
  const [recent, setRecent] = useState<ReinforcementDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { getReinforcementReplay, loading } = useBackend({ onError: setError });

  const refresh = async () => {
    setError(null);
    const data = await getReinforcementReplay() as any;
    if (data?.replay) {
      setReplay(data.replay);
      setRecent(data.recent || []);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const latest = recent[0];

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 6 }}>Phase 5 Reinforcement Optimizer</h2>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            Reward shaping, reinforcement gates, mutation weights, and replay verification.
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            background: loading ? '#1E293B' : replay?.stable ? '#10B981' : '#F59E0B',
            border: 'none',
            borderRadius: 6,
            color: '#0A0E1A',
            cursor: loading ? 'default' : 'pointer',
            fontSize: 12,
            fontWeight: 800,
            padding: '8px 12px',
          }}
        >
          {loading ? 'Verifying' : replay?.stable ? 'Replay Stable' : 'Verify'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)', borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="Replay" value={replay?.stable ? 'stable' : 'pending'} color={replay?.stable ? '#10B981' : '#F59E0B'} />
        <Metric label="Checksum" value={replay?.checksum || '-'} color="#22D3EE" />
        <Metric label="Decisions" value={String(replay?.decisionCount ?? '-')} color="#6366F1" />
        <Metric label="Mutation" value={latest ? latest.mutationWeight.toFixed(2) : '-'} color="#F59E0B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Gate Status</div>
          {Object.entries(replay?.gateStatuses || {}).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>
              <span>{status}</span>
              <span style={{ color: '#22D3EE', fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
            </div>
          ))}
        </div>

        <div style={panelStyle}>
          <div style={panelTitleStyle}>Latest Decision</div>
          {latest ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <Line label="Design" value={latest.designId} />
              <Line label="Reward" value={`${(latest.total * 100).toFixed(1)}%`} />
              <Line label="Gate" value={latest.gate.status} />
              <Line label="Lineage" value={latest.lineage.rewardChecksum} />
            </div>
          ) : (
            <div style={{ color: '#64748B', fontSize: 12 }}>No persisted reinforcement decisions yet.</div>
          )}
        </div>
      </div>
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
  <div style={{ display: 'grid', gridTemplateColumns: '74px 1fr', gap: 8, color: '#94A3B8', fontSize: 12 }}>
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
