/**
 * AGROS Debug Panel
 * 
 * Real-time visualization of system state, metrics, integrity,
 * and drift detection for debugging and monitoring.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { metrics, AggregatedMetric, MetricCategory } from '../debug/metrics';
import { trace, LogEntry } from '../debug/trace';
import { integrity, IntegrityReport, IntegrityStatus } from '../struthio/integrity';
import { drift, DriftEvent, DriftSummary } from '../struthio/drift';
import { registry, SystemTopology } from '../registry/manifest';
import { checkpoints, CheckpointSummary } from '../checkpoints/manager';

interface DebugPanelProps {
  sessionId: string;
  onClose?: () => void;
}

type TabId = 'metrics' | 'logs' | 'integrity' | 'drift' | 'architecture' | 'checkpoints';

export const DebugPanel: React.FC<DebugPanelProps> = ({ sessionId, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('metrics');
  const [collapsed, setCollapsed] = useState(false);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'metrics', label: 'Metrics' },
    { id: 'logs', label: 'Logs' },
    { id: 'integrity', label: 'Integrity' },
    { id: 'drift', label: 'Drift' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'checkpoints', label: 'Checkpoints' },
  ];

  if (collapsed) {
    return (
      <div style={styles.collapsedPanel}>
        <button onClick={() => setCollapsed(false)} style={styles.expandButton}>
          AGROS Debug
        </button>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={styles.title}>AGROS Debug Panel</div>
        <div style={styles.headerActions}>
          <span style={styles.sessionId}>{sessionId.slice(0, 12)}...</span>
          <button onClick={() => setCollapsed(true)} style={styles.iconButton}>_</button>
          {onClose && <button onClick={onClose} style={styles.iconButton}>×</button>}
        </div>
      </div>

      <div style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'metrics' && <MetricsTab />}
        {activeTab === 'logs' && <LogsTab />}
        {activeTab === 'integrity' && <IntegrityTab />}
        {activeTab === 'drift' && <DriftTab />}
        {activeTab === 'architecture' && <ArchitectureTab />}
        {activeTab === 'checkpoints' && <CheckpointsTab sessionId={sessionId} />}
      </div>
    </div>
  );
};

// Metrics Tab
const MetricsTab: React.FC = () => {
  const [metricsData, setMetricsData] = useState<Map<string, AggregatedMetric>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<MetricCategory | 'all'>('all');

  useEffect(() => {
    const interval = setInterval(() => {
      setMetricsData(metrics.getAll());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredMetrics = Array.from(metricsData.values())
    .filter(m => selectedCategory === 'all' || m.category === selectedCategory)
    .filter(m => m.count > 0);

  return (
    <div>
      <div style={styles.filterRow}>
        {(['all', 'performance', 'evolution', 'memory', 'error', 'validation'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              ...styles.filterButton,
              ...(selectedCategory === cat ? styles.activeFilter : {}),
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={styles.metricsGrid}>
        {filteredMetrics.map(m => (
          <div key={m.name} style={styles.metricCard}>
            <div style={styles.metricName}>{m.name}</div>
            <div style={styles.metricValue}>{formatNumber(m.lastValue)}</div>
            <div style={styles.metricStats}>
              avg: {formatNumber(m.avg)} | 
              min: {formatNumber(m.min)} | 
              max: {formatNumber(m.max)}
            </div>
            <div style={styles.metricCategory}>{m.category}</div>
          </div>
        ))}
        {filteredMetrics.length === 0 && (
          <div style={styles.emptyState}>No metrics recorded yet</div>
        )}
      </div>
    </div>
  );
};

// Logs Tab
const LogsTab: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(trace.getEntries().slice(-100));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => 
    filter === '' || 
    log.message.toLowerCase().includes(filter.toLowerCase()) ||
    log.level.includes(filter.toLowerCase())
  );

  return (
    <div>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter logs..."
        style={styles.searchInput}
      />
      <div style={styles.logsList}>
        {filteredLogs.map((log, i) => (
          <div key={i} style={{ ...styles.logEntry, ...getLogStyle(log.level) }}>
            <span style={styles.logTime}>
              {new Date(log.timestamp).toISOString().slice(11, 23)}
            </span>
            <span style={styles.logLevel}>[{log.level.toUpperCase()}]</span>
            <span style={styles.logMessage}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Integrity Tab
const IntegrityTab: React.FC = () => {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [running, setRunning] = useState(false);

  const runCheck = useCallback(async () => {
    setRunning(true);
    const result = await integrity.runChecks();
    setReport(result);
    setRunning(false);
  }, []);

  useEffect(() => {
    const stored = integrity.getLastReport();
    if (stored) setReport(stored);
  }, []);

  return (
    <div>
      <div style={styles.actionRow}>
        <button onClick={runCheck} disabled={running} style={styles.actionButton}>
          {running ? 'Running...' : 'Run Integrity Check'}
        </button>
        <StatusBadge status={report?.overallStatus || 'unknown'} />
      </div>

      {report && (
        <div style={styles.reportSection}>
          <div style={styles.reportHeader}>
            Last check: {new Date(report.timestamp).toLocaleTimeString()}
          </div>
          
          <div style={styles.checksList}>
            {report.checks.map(check => (
              <div key={check.name} style={styles.checkItem}>
                <span style={{
                  ...styles.checkStatus,
                  color: check.result.passed ? '#10B981' : '#EF4444',
                }}>
                  {check.result.passed ? '✓' : '✗'}
                </span>
                <span style={styles.checkName}>{check.name}</span>
                <span style={styles.checkDuration}>{check.duration.toFixed(1)}ms</span>
              </div>
            ))}
          </div>

          {report.driftDetected && (
            <div style={styles.warningBox}>
              Drift detected - recovery {report.recoverySuccessful ? 'successful' : 'attempted'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Drift Tab
const DriftTab: React.FC = () => {
  const [summary, setSummary] = useState<DriftSummary | null>(null);
  const [events, setEvents] = useState<DriftEvent[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSummary(drift.getSummary());
      setEvents(drift.getUnresolvedEvents());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {summary && (
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Events</div>
            <div style={styles.summaryValue}>{summary.total}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Unresolved</div>
            <div style={{ ...styles.summaryValue, color: summary.unresolved > 0 ? '#EF4444' : '#10B981' }}>
              {summary.unresolved}
            </div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Recent (1min)</div>
            <div style={styles.summaryValue}>{summary.recent}</div>
          </div>
        </div>
      )}

      <div style={styles.eventsList}>
        {events.length === 0 && (
          <div style={styles.emptyState}>No unresolved drift events</div>
        )}
        {events.map(event => (
          <div key={event.id} style={styles.eventCard}>
            <div style={styles.eventHeader}>
              <span style={{ ...styles.severityBadge, ...getSeverityStyle(event.severity) }}>
                {event.severity}
              </span>
              <span style={styles.eventType}>{event.type}</span>
              <span style={styles.eventTime}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div style={styles.eventMessage}>{event.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Architecture Tab
const ArchitectureTab: React.FC = () => {
  const [topology, setTopology] = useState<SystemTopology | null>(null);

  useEffect(() => {
    registry.init().then(t => setTopology(t));
  }, []);

  if (!topology) return <div style={styles.emptyState}>Loading architecture...</div>;

  return (
    <div>
      <div style={styles.archHeader}>
        <span>Version: {topology.version}</span>
        <span>Checksum: {topology.integrity.checksum}</span>
      </div>

      <div style={styles.layersList}>
        {topology.layers.map(layer => (
          <div key={layer.name} style={styles.layerCard}>
            <div style={styles.layerHeader}>
              <span style={styles.layerOrder}>{layer.order}</span>
              <span style={styles.layerName}>{layer.name}</span>
              <StatusBadge status={layer.status} small />
            </div>
            <div style={styles.componentsList}>
              {layer.components.map(comp => (
                <div key={comp.name} style={styles.componentItem}>
                  <span style={{
                    ...styles.componentStatus,
                    color: comp.status === 'stable' ? '#10B981' : 
                           comp.status === 'evolving' ? '#F59E0B' : '#EF4444',
                  }}>●</span>
                  <span style={styles.componentName}>{comp.name}</span>
                  <span style={styles.componentType}>{comp.type}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Checkpoints Tab
const CheckpointsTab: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [checkpointList, setCheckpointList] = useState<CheckpointSummary[]>([]);

  useEffect(() => {
    checkpoints.listCheckpoints(sessionId).then(setCheckpointList);
  }, [sessionId]);

  return (
    <div>
      <div style={styles.checkpointHeader}>
        <span>{checkpointList.length} checkpoints</span>
      </div>

      <div style={styles.checkpointList}>
        {checkpointList.length === 0 && (
          <div style={styles.emptyState}>No checkpoints for this session</div>
        )}
        {checkpointList.map(ckpt => (
          <div key={ckpt.id} style={styles.checkpointCard}>
            <div style={styles.checkpointMain}>
              <span style={styles.checkpointEpoch}>Epoch {ckpt.epoch}</span>
              <span style={styles.checkpointTime}>
                {new Date(ckpt.timestamp).toLocaleString()}
              </span>
            </div>
            <div style={styles.checkpointMeta}>
              Pop: {ckpt.populationSize} | 
              Fitness: {(ckpt.avgFitness * 100).toFixed(1)}% | 
              {ckpt.validated ? '✓ Valid' : '? Unvalidated'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper Components
const StatusBadge: React.FC<{ status: IntegrityStatus | string; small?: boolean }> = ({ status, small }) => {
  const colors: Record<string, string> = {
    healthy: '#10B981',
    stable: '#10B981',
    degraded: '#F59E0B',
    evolving: '#F59E0B',
    initializing: '#3B82F6',
    critical: '#EF4444',
    unknown: '#6B7280',
  };

  return (
    <span style={{
      background: colors[status] || colors.unknown,
      color: '#FFF',
      padding: small ? '2px 6px' : '4px 10px',
      borderRadius: 4,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
};

// Utility functions
function formatNumber(n: number): string {
  if (n === Infinity || n === -Infinity) return '—';
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

function getLogStyle(level: string): React.CSSProperties {
  const colors: Record<string, string> = {
    debug: '#6B7280',
    info: '#3B82F6',
    warn: '#F59E0B',
    error: '#EF4444',
    critical: '#8B5CF6',
  };
  return { borderLeft: `3px solid ${colors[level] || '#6B7280'}` };
}

function getSeverityStyle(severity: string): React.CSSProperties {
  const colors: Record<string, string> = {
    low: '#3B82F6',
    medium: '#F59E0B',
    high: '#EF4444',
    critical: '#8B5CF6',
  };
  return { background: colors[severity] || '#6B7280' };
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    bottom: 0,
    right: 0,
    width: 480,
    maxHeight: '60vh',
    background: '#0F172A',
    border: '1px solid #1E293B',
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 12,
    zIndex: 9999,
  },
  collapsedPanel: {
    position: 'fixed',
    bottom: 0,
    right: 16,
    zIndex: 9999,
  },
  expandButton: {
    background: '#22D3EE',
    color: '#0F172A',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px 4px 0 0',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    fontWeight: 600,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid #1E293B',
    background: '#1E293B',
  },
  title: {
    color: '#22D3EE',
    fontWeight: 600,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sessionId: {
    color: '#64748B',
    fontSize: 10,
  },
  iconButton: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 4px',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #1E293B',
    padding: '0 8px',
  },
  tab: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 11,
    borderBottom: '2px solid transparent',
  },
  activeTab: {
    color: '#22D3EE',
    borderBottomColor: '#22D3EE',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 12,
  },
  filterRow: {
    display: 'flex',
    gap: 4,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterButton: {
    background: '#1E293B',
    border: 'none',
    color: '#64748B',
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 10,
  },
  activeFilter: {
    background: '#22D3EE',
    color: '#0F172A',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  metricCard: {
    background: '#1E293B',
    borderRadius: 4,
    padding: 10,
  },
  metricName: {
    color: '#94A3B8',
    fontSize: 10,
    marginBottom: 4,
  },
  metricValue: {
    color: '#22D3EE',
    fontSize: 18,
    fontWeight: 600,
  },
  metricStats: {
    color: '#64748B',
    fontSize: 9,
    marginTop: 4,
  },
  metricCategory: {
    color: '#475569',
    fontSize: 9,
    marginTop: 4,
  },
  emptyState: {
    color: '#64748B',
    textAlign: 'center',
    padding: 24,
  },
  searchInput: {
    width: '100%',
    background: '#1E293B',
    border: '1px solid #334155',
    borderRadius: 4,
    padding: '6px 10px',
    color: '#E2E8F0',
    marginBottom: 8,
    fontSize: 11,
  },
  logsList: {
    maxHeight: 300,
    overflow: 'auto',
  },
  logEntry: {
    padding: '4px 8px',
    marginBottom: 2,
    background: '#1E293B',
    borderRadius: 2,
  },
  logTime: {
    color: '#64748B',
    marginRight: 8,
  },
  logLevel: {
    marginRight: 8,
  },
  logMessage: {
    color: '#E2E8F0',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    background: '#22D3EE',
    color: '#0F172A',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },
  reportSection: {
    background: '#1E293B',
    borderRadius: 4,
    padding: 12,
  },
  reportHeader: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 8,
  },
  checksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
  },
  checkStatus: {
    fontWeight: 600,
  },
  checkName: {
    color: '#E2E8F0',
    flex: 1,
  },
  checkDuration: {
    color: '#64748B',
    fontSize: 10,
  },
  warningBox: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid #F59E0B',
    borderRadius: 4,
    padding: 8,
    color: '#F59E0B',
    marginTop: 8,
    fontSize: 11,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    background: '#1E293B',
    borderRadius: 4,
    padding: 10,
    textAlign: 'center',
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  summaryValue: {
    color: '#22D3EE',
    fontSize: 20,
    fontWeight: 600,
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  eventCard: {
    background: '#1E293B',
    borderRadius: 4,
    padding: 10,
  },
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  severityBadge: {
    color: '#FFF',
    padding: '2px 6px',
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  eventType: {
    color: '#94A3B8',
    fontSize: 10,
    flex: 1,
  },
  eventTime: {
    color: '#64748B',
    fontSize: 10,
  },
  eventMessage: {
    color: '#E2E8F0',
    fontSize: 11,
  },
  archHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#64748B',
    fontSize: 10,
    marginBottom: 12,
  },
  layersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  layerCard: {
    background: '#1E293B',
    borderRadius: 4,
    padding: 10,
  },
  layerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  layerOrder: {
    background: '#334155',
    color: '#94A3B8',
    width: 20,
    height: 20,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
  },
  layerName: {
    color: '#E2E8F0',
    fontWeight: 600,
    flex: 1,
  },
  componentsList: {
    paddingLeft: 28,
  },
  componentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 0',
  },
  componentStatus: {
    fontSize: 8,
  },
  componentName: {
    color: '#94A3B8',
    flex: 1,
  },
  componentType: {
    color: '#64748B',
    fontSize: 9,
  },
  checkpointHeader: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 8,
  },
  checkpointList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  checkpointCard: {
    background: '#1E293B',
    borderRadius: 4,
    padding: 10,
  },
  checkpointMain: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  checkpointEpoch: {
    color: '#22D3EE',
    fontWeight: 600,
  },
  checkpointTime: {
    color: '#64748B',
    fontSize: 10,
  },
  checkpointMeta: {
    color: '#94A3B8',
    fontSize: 10,
  },
};

export default DebugPanel;
