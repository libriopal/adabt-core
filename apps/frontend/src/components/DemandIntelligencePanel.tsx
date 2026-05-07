import React, { useEffect, useState } from 'react';
import { useBackend } from '../hooks/useBackend';
import { DemandResult, DemandSourceBreakdown } from '../lib/types';

const DEFAULT_INPUT = 'mythic bonus volatility';

export const DemandIntelligencePanel: React.FC = () => {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [demand, setDemand] = useState<DemandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getDemand, loading } = useBackend({ onError: setError });

  useEffect(() => {
    let cancelled = false;

    getDemand({ input: DEFAULT_INPUT }).then((data: any) => {
      if (!cancelled && data?.demand) setDemand(data.demand);
    });

    return () => {
      cancelled = true;
    };
  }, [getDemand]);

  const handleRefresh = async () => {
    setError(null);
    const data = await getDemand({ input });
    if ((data as any)?.demand) setDemand((data as any).demand);
  };

  const sourceBreakdown = demand?.sourceBreakdown || [];
  const reinforcement = demand?.reinforcementInputs;

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 6 }}>Phase 4 Demand Intelligence</h2>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            Source-weighted trend ingestion for reinforcement inputs.
          </div>
        </div>
        <div style={{ color: '#10B981', background: 'rgba(16,185,129,0.14)', border: '1px solid #10B981', borderRadius: 4, padding: '5px 10px', fontSize: 11, fontWeight: 700 }}>
          {demand?.checksum ? `CHK ${demand.checksum}` : 'Pending'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 112px', gap: 12, marginBottom: 18 }}>
        <input
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder="Demand focus"
          style={{
            background: '#0A0E1A',
            border: '1px solid #1E293B',
            borderRadius: 6,
            color: '#E2E8F0',
            padding: '10px 12px',
            fontSize: 13,
          }}
        />
        <button
          onClick={handleRefresh}
          disabled={loading || !input.trim()}
          style={{
            background: loading ? '#1E293B' : '#22D3EE',
            border: 'none',
            borderRadius: 6,
            color: '#0A0E1A',
            cursor: loading ? 'default' : 'pointer',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {loading ? 'Scanning' : 'Scan'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)', borderRadius: 6, padding: 10, fontSize: 12, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="Demand" value={demand ? `${(demand.demandScore * 100).toFixed(1)}%` : '-'} color="#22D3EE" />
        <Metric label="Volume" value={String(demand?.volume ?? '-')} color="#6366F1" />
        <Metric label="Trend" value={reinforcement ? `${(reinforcement.trendMomentum * 100).toFixed(1)}%` : '-'} color="#F59E0B" />
        <Metric label="Popularity" value={reinforcement ? `${(reinforcement.popularityPressure * 100).toFixed(1)}%` : '-'} color="#10B981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Source Adapters</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {sourceBreakdown.map(source => (
              <SourceRow key={source.source} source={source} />
            ))}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelTitleStyle}>Keyword Clusters</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(demand?.keywordClusters || []).slice(0, 10).map(keyword => (
              <span key={keyword} style={{ color: '#94A3B8', background: '#0A0E1A', border: '1px solid #1E293B', borderRadius: 4, padding: '4px 7px', fontSize: 11 }}>
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SourceRow: React.FC<{ source: DemandSourceBreakdown }> = ({ source }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '126px 1fr 48px', gap: 10, alignItems: 'center' }}>
    <div style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {source.source}
    </div>
    <div style={{ height: 6, background: '#0A0E1A', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(5, source.confidence * 100)}%`, background: '#22D3EE' }} />
    </div>
    <div style={{ color: '#64748B', fontSize: 11, textAlign: 'right' }}>{source.signalCount}</div>
  </div>
);

const Metric: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#0A0E1A', borderRadius: 6, padding: 12, border: '1px solid #1E293B', minWidth: 0 }}>
    <div style={{ color: '#64748B', fontSize: 10, marginBottom: 5 }}>{label}</div>
    <div style={{ color, fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
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
