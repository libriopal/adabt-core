import React, { useMemo } from 'react';
import { createCocoonState, getCocoonArchitectureMap } from '../cocoon/serializer';
import { verifyCocoonReplay } from '../cocoon/verifier';

export const CocoonDebugPanel: React.FC = () => {
  const cocoon = useMemo(() => createCocoonState(), []);
  const replay = useMemo(() => verifyCocoonReplay(), []);
  const architectureMap = useMemo(() => getCocoonArchitectureMap(cocoon), [cocoon]);

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Phase 6 Cocoon Debug</h2>
          <p style={styles.subtitle}>Context collapse compression, topology preservation, and reconstruction replay.</p>
        </div>
        <StatusPill label={replay.stable ? 'Replay stable' : 'Replay drift'} tone={replay.stable ? 'ok' : 'warn'} />
      </div>

      <div style={styles.metricsGrid}>
        <Metric label="Checksum" value={replay.checksum} />
        <Metric label="Accuracy" value={`${(replay.reconstruction.accuracy * 100).toFixed(1)}%`} />
        <Metric label="Continuity" value={`${(replay.continuity.overall * 100).toFixed(1)}%`} />
        <Metric label="Entropy Delta" value={replay.metrics.entropyDelta.toFixed(4)} />
        <Metric label="Compression" value={`${(replay.metrics.compressionRatio * 100).toFixed(1)}%`} />
        <Metric label="Topology" value={`${replay.topology.nodeCount}N/${replay.topology.edgeCount}E`} />
      </div>

      <div style={styles.columns}>
        <div style={styles.column}>
          <h3 style={styles.sectionTitle}>Continuity Scores</h3>
          <Bar label="Emotional" value={replay.continuity.emotional} color="#F472B6" />
          <Bar label="Reasoning" value={replay.continuity.reasoning} color="#38BDF8" />
          <Bar label="Identity" value={replay.continuity.identity} color="#22C55E" />
          <Bar label="Architecture" value={replay.continuity.architecture} color="#A78BFA" />
          <Bar label="Reinforcement" value={replay.continuity.reinforcement} color="#F59E0B" />
        </div>

        <div style={styles.column}>
          <h3 style={styles.sectionTitle}>Topology Inspector</h3>
          <div style={styles.factRow}><span>Encoder</span><code>{cocoon.encoding.encoder}</code></div>
          <div style={styles.factRow}><span>Components</span><code>{replay.topology.connectedComponents}</code></div>
          <div style={styles.factRow}><span>Avg Degree</span><code>{replay.topology.averageDegree}</code></div>
          <div style={styles.factRow}><span>Anchor Signature</span><code>{replay.topology.anchorSignature}</code></div>
          <div style={styles.factRow}><span>Recovery</span><code>{cocoon.recovery.checkpointId}</code></div>
        </div>
      </div>

      <div style={styles.map}>
        <h3 style={styles.sectionTitle}>Cocoon Architecture Map</h3>
        {architectureMap.map((entry, index) => (
          <div key={entry} style={styles.mapItem}>
            <span style={styles.mapIndex}>{index + 1}</span>
            <span>{entry}</span>
          </div>
        ))}
      </div>

      {replay.reconstruction.errors.length > 0 && (
        <div style={styles.errors}>
          {replay.reconstruction.errors.map(error => <div key={error}>{error}</div>)}
        </div>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.metric}>
    <div style={styles.metricLabel}>{label}</div>
    <div style={styles.metricValue}>{value}</div>
  </div>
);

const StatusPill: React.FC<{ label: string; tone: 'ok' | 'warn' }> = ({ label, tone }) => (
  <span style={{ ...styles.statusPill, color: tone === 'ok' ? '#10B981' : '#F59E0B', borderColor: tone === 'ok' ? '#10B981' : '#F59E0B' }}>
    {label}
  </span>
);

const Bar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={styles.barRow}>
    <span style={styles.barLabel}>{label}</span>
    <div style={styles.barTrack}>
      <div style={{ ...styles.barFill, width: `${Math.min(100, value * 100)}%`, background: color }} />
    </div>
    <code style={styles.barValue}>{(value * 100).toFixed(1)}%</code>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#12172B',
    borderRadius: 8,
    padding: 24,
    border: '1px solid #1E293B',
    marginBottom: 24,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  title: {
    color: '#94A3B8',
    fontSize: 14,
    margin: 0,
    marginBottom: 6,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 12,
    margin: 0,
  },
  statusPill: {
    border: '1px solid',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    flexShrink: 0,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 10,
    marginBottom: 18,
  },
  metric: {
    background: '#0A0E1A',
    border: '1px solid #1E293B',
    borderRadius: 6,
    padding: 12,
    minHeight: 58,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#E2E8F0',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 13,
    overflowWrap: 'anywhere',
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
    marginBottom: 18,
  },
  column: {
    background: '#0A0E1A',
    border: '1px solid #1E293B',
    borderRadius: 6,
    padding: 14,
  },
  sectionTitle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 0,
    marginBottom: 12,
  },
  factRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: '#94A3B8',
    fontSize: 11,
    padding: '7px 0',
    borderBottom: '1px solid rgba(30,41,59,0.65)',
  },
  barRow: {
    display: 'grid',
    gridTemplateColumns: '92px 1fr 58px',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  barLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  barTrack: {
    height: 7,
    background: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    color: '#CBD5E1',
    fontSize: 10,
    textAlign: 'right',
  },
  map: {
    background: '#0A0E1A',
    border: '1px solid #1E293B',
    borderRadius: 6,
    padding: 14,
  },
  mapItem: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 8,
  },
  mapIndex: {
    width: 22,
    height: 22,
    borderRadius: 4,
    background: 'rgba(34,211,238,0.12)',
    color: '#22D3EE',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'JetBrains Mono, monospace',
    flexShrink: 0,
  },
  errors: {
    marginTop: 12,
    color: '#F87171',
    fontSize: 11,
  },
};
