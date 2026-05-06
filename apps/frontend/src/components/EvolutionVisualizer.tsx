import React, { useEffect, useState } from 'react';
import { useBackend } from '../hooks/useBackend';

interface EvolutionVisualizerProps {
  runId?: string;
}

export const EvolutionVisualizer: React.FC<EvolutionVisualizerProps> = ({ runId }) => {
  const [selectedRun] = useState<string | null>(runId || null);
  const [state, setState] = useState<any>(null);
  const [polling, setPolling] = useState(false);

  const { getEvolutionState, pauseEvolution, loading } = useBackend({ onError: console.error });

  useEffect(() => {
    if (!selectedRun) return;
    setPolling(true);
    const interval = setInterval(async () => {
      const data = await getEvolutionState(selectedRun) as any;
      if (data) {
        setState(data.state);
        if (data.state.status !== 'running') setPolling(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedRun, getEvolutionState]);

  const handlePause = async () => {
    if (!selectedRun) return;
    await pauseEvolution(selectedRun);
  };

  if (!state) {
    return (
      <div style={{ padding: 24, color: '#64748B' }}>
        {loading ? 'Loading...' : 'Select or start an evolution run'}
      </div>
    );
  }

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: '#22D3EE', fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}>
            Evolution Run: {state.runId?.slice(0, 12)}...
          </h3>
          <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
            Generation {state.currentGeneration} / {state.maxGenerations}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatusBadge status={state.status} />
          {state.status === 'running' && (
            <button onClick={handlePause} style={{
              padding: '4px 12px', background: 'rgba(239,68,68,0.2)',
              border: '1px solid #EF4444', color: '#EF4444', borderRadius: 4, cursor: 'pointer', fontSize: 11,
            }}>
              Pause
            </button>
          )}
        </div>
      </div>

      {state.history?.length > 1 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 8 }}>
            Score Progression (Last {state.history.length} generations)
          </div>
          <ScoreGraph data={state.history} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Best Score" value={state.bestScore ? `${(state.bestScore * 100).toFixed(1)}%` : '—'} color="#22D3EE" />
        <StatCard label="Current Gen" value={String(state.currentGeneration)} color="#6366F1" />
        <StatCard label="Status" value={state.status} color={state.status === 'running' ? '#22C55E' : '#94A3B8'} />
        <StatCard
          label="Diversity"
          value={state.history?.length > 0 ? `${(state.history[state.history.length - 1].diversity * 100).toFixed(0)}%` : '—'}
          color="#F59E0B"
        />
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    running: { bg: 'rgba(34,211,238,0.2)', text: '#22D3EE' },
    completed: { bg: 'rgba(34,197,94,0.2)', text: '#22C55E' },
    paused: { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B' },
    error: { bg: 'rgba(239,68,68,0.2)', text: '#EF4444' },
  };
  const c = colors[status] || colors.error;
  return (
    <div style={{ padding: '4px 12px', background: c.bg, color: c.text, borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
      {status}
    </div>
  );
};

const ScoreGraph: React.FC<{ data: any[] }> = ({ data }) => {
  const W = 400; const H = 100; const P = 10;
  const scores = data.map(d => d.maxScore);
  const max = Math.max(...scores);
  const min = Math.min(...data.map(d => d.minScore));
  const range = max - min || 1;

  const pts = data.map((d, i) => ({
    x: P + (i / Math.max(data.length - 1, 1)) * (W - 2 * P),
    y: H - P - ((d.maxScore - min) / range) * (H - 2 * P),
    ay: H - P - ((d.avgScore - min) / range) * (H - 2 * P),
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const avgD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.ay}`).join(' ');

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={P} y1={P + t * (H - 2 * P)} x2={W - P} y2={P + t * (H - 2 * P)} stroke="#1E293B" strokeWidth={1} />
      ))}
      <path d={avgD} fill="none" stroke="#6366F1" strokeWidth={2} opacity={0.5} />
      <path d={pathD} fill="none" stroke="#22D3EE" strokeWidth={2} />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#22D3EE" />)}
    </svg>
  );
};

const StatCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: 'rgba(10,14,26,0.5)', borderRadius: 4, padding: 12, border: '1px solid #1E293B' }}>
    <div style={{ color: '#64748B', fontSize: 10, marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontSize: 18, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
  </div>
);
