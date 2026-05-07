import React, { useMemo, useState } from 'react';
import {
  DEFAULT_EVOLUTION_CONFIG,
  runEvolutionSimulation,
  verifyDeterministicParity,
} from '../evolution/simulator';
import { EpochSnapshot } from '../evolution/types';

export const EvolutionSimulatorPanel: React.FC = () => {
  const [seed, setSeed] = useState(DEFAULT_EVOLUTION_CONFIG.seed);
  const [epochCount, setEpochCount] = useState(DEFAULT_EVOLUTION_CONFIG.epochs);
  const [mutationRate, setMutationRate] = useState(DEFAULT_EVOLUTION_CONFIG.mutationRate);
  const run = useMemo(() => runEvolutionSimulation({
    seed,
    epochs: epochCount,
    mutationRate,
  }), [seed, epochCount, mutationRate]);
  const parityVerified = useMemo(() => verifyDeterministicParity({
    seed,
    epochs: epochCount,
    mutationRate,
  }), [seed, epochCount, mutationRate]);
  const latest = run.epochs[run.epochs.length - 1];
  const best = [...latest.population].sort((a, b) => b.fitness - a.fitness)[0];

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 6 }}>Phase 3 Evolution Simulator</h2>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            Deterministic local epoch simulation with scoring, mutation, selection, and lineage diagnostics.
          </div>
        </div>
        <StatusPill ok={parityVerified} label={parityVerified ? 'Parity verified' : 'Parity drift'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 130px 160px', gap: 12, marginBottom: 18 }}>
        <label style={{ color: '#64748B', fontSize: 11 }}>
          Seed
          <input
            value={seed}
            onChange={event => setSeed(event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ color: '#64748B', fontSize: 11 }}>
          Epochs
          <input
            type="number"
            min={1}
            max={24}
            value={epochCount}
            onChange={event => setEpochCount(Number(event.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ color: '#64748B', fontSize: 11 }}>
          Mutation
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={mutationRate}
            onChange={event => setMutationRate(Number(event.target.value))}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="Best" value={`${(latest.bestFitness * 100).toFixed(1)}%`} color="#22D3EE" />
        <Metric label="Average" value={`${(latest.averageFitness * 100).toFixed(1)}%`} color="#6366F1" />
        <Metric label="Diversity" value={`${(latest.diversity * 100).toFixed(1)}%`} color="#F59E0B" />
        <Metric label="Mutations" value={String(run.epochs.reduce((sum, epoch) => sum + epoch.mutationCount, 0))} color="#F472B6" />
        <Metric label="Checksum" value={latest.checksum} color="#10B981" />
      </div>

      <EpochStrip epochs={run.epochs} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Best Variant</div>
          <div style={{ color: '#22D3EE', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, marginBottom: 8 }}>{best.id}</div>
          {Object.entries(best.genome).map(([gene, value]) => (
            <div key={gene} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 48px', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: '#64748B', fontSize: 11 }}>{gene}</span>
              <div style={{ height: 6, background: '#0A0E1A', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value * 100}%`, background: '#22D3EE' }} />
              </div>
              <span style={{ color: '#94A3B8', fontSize: 11, textAlign: 'right' }}>{value.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={panelStyle}>
          <div style={panelTitleStyle}>Lineage</div>
          <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>
            {latest.lineageEdges.length} inheritance edges across {latest.population.length} variants.
          </div>
          <div style={{ maxHeight: 126, overflow: 'auto' }}>
            {latest.lineageEdges.slice(0, 8).map(edge => (
              <div key={`${edge.source}-${edge.target}`} style={{ color: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>
                {edge.source.slice(0, 14)} → {edge.target.slice(0, 14)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const EpochStrip: React.FC<{ epochs: EpochSnapshot[] }> = ({ epochs }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${epochs.length}, minmax(18px, 1fr))`, gap: 4 }}>
    {epochs.map(epoch => (
      <div key={epoch.epoch} title={`Epoch ${epoch.epoch}: ${(epoch.bestFitness * 100).toFixed(1)}%`} style={{
        height: 42,
        borderRadius: 4,
        background: `linear-gradient(to top, #22D3EE ${Math.max(6, epoch.bestFitness * 100)}%, #0A0E1A ${Math.max(6, epoch.bestFitness * 100)}%)`,
        border: '1px solid #1E293B',
      }} />
    ))}
  </div>
);

const Metric: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#0A0E1A', borderRadius: 6, padding: 12, border: '1px solid #1E293B', minWidth: 0 }}>
    <div style={{ color: '#64748B', fontSize: 10, marginBottom: 5 }}>{label}</div>
    <div style={{ color, fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
  </div>
);

const StatusPill: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div style={{
    color: ok ? '#10B981' : '#EF4444',
    background: ok ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
    border: `1px solid ${ok ? '#10B981' : '#EF4444'}`,
    borderRadius: 4,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }}>
    {label}
  </div>
);

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 6,
  background: '#0A0E1A',
  border: '1px solid #1E293B',
  borderRadius: 6,
  color: '#E2E8F0',
  padding: '9px 10px',
  fontSize: 13,
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
