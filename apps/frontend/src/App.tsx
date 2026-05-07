import React, { useState, useCallback, useEffect } from 'react';
import { EvolutionVisualizer } from './components/EvolutionVisualizer';
import { DebugPanel } from './components/DebugPanel';
import { EvolutionSimulatorPanel } from './components/EvolutionSimulatorPanel';
import { DemandIntelligencePanel } from './components/DemandIntelligencePanel';
import { ReinforcementOptimizerPanel } from './components/ReinforcementOptimizerPanel';
import { CocoonDebugPanel } from './components/CocoonDebugPanel';
import { ReplayOperationsPanel } from './components/ReplayOperationsPanel';
import { useBackend } from './hooks/useBackend';
import { agros, AGROSState } from './agros/init';

const App: React.FC = () => {
  const [narrative, setNarrative] = useState('');
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<'FAST' | 'FULL' | 'HYBRID'>('FULL');
  const [designs, setDesigns] = useState<any[]>([]);
  const [evolutionRunId, setEvolutionRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agrosState, setAgrosState] = useState<AGROSState | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const { loading, generateBatch, startEvolution } = useBackend({
    onError: (e) => setError(e),
  });

  // Initialize AGROS on mount
  useEffect(() => {
    agros.init().then(state => {
      setAgrosState(state);
      console.log('[AGROS] System initialized', state.sessionId);
    }).catch(err => {
      console.error('[AGROS] Initialization failed', err);
      setError('AGROS initialization failed');
    });

    return () => {
      agros.shutdown();
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    const result = await generateBatch({ input: narrative, count, mode }) as any;
    if (result?.designs) setDesigns(result.designs);
  }, [narrative, count, mode, generateBatch]);

  const handleEvolve = useCallback(async () => {
    setError(null);
    const result = await startEvolution({ maxGenerations: 50, populationSize: 20 });
    if (result?.runId) setEvolutionRunId(result.runId);
  }, [startEvolution]);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h1 style={{ color: '#22D3EE', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8, marginTop: 0 }}>SlotGPT</h1>
            <p style={{ color: '#64748B', margin: 0 }}>AI-Driven Slot Machine Design Generator</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {agrosState && (
              <span style={{ color: '#10B981', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                AGROS: {agrosState.sessionId.slice(0, 12)}...
              </span>
            )}
            <button
              onClick={() => setShowDebug(!showDebug)}
              style={{
                background: showDebug ? '#22D3EE' : 'rgba(34,211,238,0.1)',
                color: showDebug ? '#0A0E1A' : '#22D3EE',
                border: '1px solid #22D3EE',
                padding: '6px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600,
              }}
            >
              {showDebug ? 'Hide Debug' : 'Debug'}
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 32 }} />

        {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

        <EvolutionSimulatorPanel />
        <DemandIntelligencePanel />
        <ReinforcementOptimizerPanel />
        <ReplayOperationsPanel />
        <CocoonDebugPanel />

        <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 16 }}>Generate Designs</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              value={narrative}
              onChange={e => setNarrative(e.target.value)}
              placeholder="Enter narrative (e.g. cyberpunk heist)"
              style={{ flex: 1, minWidth: 240, background: '#0A0E1A', border: '1px solid #1E293B', borderRadius: 6, padding: '10px 14px', color: '#E2E8F0', fontSize: 14 }}
            />
            <input
              type="number"
              value={count}
              min={1} max={100}
              onChange={e => setCount(Number(e.target.value))}
              style={{ width: 80, background: '#0A0E1A', border: '1px solid #1E293B', borderRadius: 6, padding: '10px 14px', color: '#E2E8F0', fontSize: 14 }}
            />
            <select
              value={mode}
              onChange={e => setMode(e.target.value as any)}
              style={{ background: '#0A0E1A', border: '1px solid #1E293B', borderRadius: 6, padding: '10px 14px', color: '#E2E8F0', fontSize: 14 }}
            >
              <option value="FAST">FAST</option>
              <option value="FULL">FULL</option>
              <option value="HYBRID">HYBRID</option>
            </select>
            <button
              onClick={handleGenerate}
              disabled={loading || !narrative.trim()}
              style={{ padding: '10px 24px', background: loading ? '#1E293B' : '#22D3EE', color: '#0A0E1A', border: 'none', borderRadius: 6, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontSize: 14 }}
            >
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        {designs.length > 0 && (
          <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Designs ({designs.length})</h2>
              <button
                onClick={handleEvolve}
                disabled={loading}
                style={{ padding: '8px 20px', background: 'rgba(99,102,241,0.2)', color: '#6366F1', border: '1px solid #6366F1', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Start Evolution
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {designs.map((d, i) => (
                <DesignCard key={d.id || i} design={d} />
              ))}
            </div>
          </div>
        )}

        {evolutionRunId && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>Evolution Run</h2>
            <EvolutionVisualizer runId={evolutionRunId} />
          </div>
        )}
      </div>

      {/* AGROS Debug Panel */}
      {showDebug && agrosState && (
        <DebugPanel 
          sessionId={agrosState.sessionId} 
          onClose={() => setShowDebug(false)} 
        />
      )}
    </div>
  );
};

const ErrorBanner: React.FC<{ error: string; onDismiss: () => void }> = ({ error, onDismiss }) => {
  const match = error.match(/^(.*?)(\s*\[([A-Z]+-[0-9A-F]+)\])?$/);
  const message = match?.[1] ?? error;
  const debugId = match?.[3];

  return (
    <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444', borderRadius: 6, padding: '10px 16px', marginBottom: 16, color: '#FCA5A5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ flex: 1 }}>
        {message}
        {debugId && (
          <code style={{ marginLeft: 8, background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#F87171', letterSpacing: '0.05em' }}>
            {debugId}
          </code>
        )}
      </span>
      {debugId && (
        <button
          onClick={() => navigator.clipboard?.writeText(debugId)}
          title="Copy debug ID"
          style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 4, color: '#F87171', cursor: 'pointer', fontSize: 10, padding: '2px 8px', flexShrink: 0 }}
        >
          copy ID
        </button>
      )}
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
};

const DesignCard: React.FC<{ design: any }> = ({ design }) => {
  const score = design.score?.total ?? design.totalScore ?? 0;
  const volatility = design.mechanics?.volatilityClass || design.volatilityClass || '—';
  const theme = design.intentVector?.thematicCluster || design.theme || '—';

  return (
    <div style={{ background: '#0A0E1A', borderRadius: 6, padding: 16, border: '1px solid #1E293B' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ color: '#22D3EE', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
          {(score * 100).toFixed(1)}%
        </div>
        <span style={{ fontSize: 10, color: '#94A3B8', background: 'rgba(148,163,184,0.1)', padding: '2px 8px', borderRadius: 10 }}>
          {volatility}
        </span>
      </div>
      <div style={{ color: '#64748B', fontSize: 11, marginBottom: 6 }}>{theme}</div>
      {design.content?.content && (
        <div style={{ color: '#94A3B8', fontSize: 11, fontStyle: 'italic', borderTop: '1px solid #1E293B', paddingTop: 8, marginTop: 8 }}>
          {design.content.content.slice(0, 100)}{design.content.content.length > 100 ? '…' : ''}
        </div>
      )}
    </div>
  );
};

export default App;
