import React, { useEffect, useState } from 'react';
import { useBackend } from '../hooks/useBackend';
import {
  ReleaseBundleSummary,
  ReleaseDecisionOutcome,
  ReleaseDecisionRecord,
  ReleaseDriftReport,
  ReleaseEvidenceComparison,
  ReleaseEvidenceRecord,
  ReleaseGateReport,
  ReleaseReadinessReport,
  ReleaseRetentionReport,
} from '../lib/types';

const DEFAULT_STREAM = 'agros-replay-suite';
const DEFAULT_PROVIDER = 'local-docker';

export const ReleaseReadinessPanel: React.FC = () => {
  const [stream, setStream] = useState(DEFAULT_STREAM);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [release, setRelease] = useState<ReleaseReadinessReport | null>(null);
  const [evidenceHistory, setEvidenceHistory] = useState<ReleaseEvidenceRecord[]>([]);
  const [decisions, setDecisions] = useState<ReleaseDecisionRecord[]>([]);
  const [comparison, setComparison] = useState<ReleaseEvidenceComparison | null>(null);
  const [bundle, setBundle] = useState<ReleaseBundleSummary | null>(null);
  const [drift, setDrift] = useState<ReleaseDriftReport | null>(null);
  const [retention, setRetention] = useState<ReleaseRetentionReport | null>(null);
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyRollbackStatus, setHistoryRollbackStatus] = useState('');
  const [decision, setDecision] = useState<ReleaseDecisionOutcome>('go');
  const [decisionReason, setDecisionReason] = useState('operator accepted release evidence');
  const [commitSha, setCommitSha] = useState('');
  const [branchName, setBranchName] = useState('');
  const [pullRequestUrl, setPullRequestUrl] = useState('');
  const [retainLatest, setRetainLatest] = useState(20);
  const [evidenceExportId, setEvidenceExportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    applyReleaseEvidenceRetention,
    compareReleaseEvidence,
    createReleaseDecision,
    createReleaseReconciliation,
    getReleaseBundleSummary,
    getReleaseDrift,
    getReleaseEvidenceExport,
    getReleaseEvidenceHistory,
    getReleaseDecisions,
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
    const history = await getReleaseEvidenceHistory({
      stream,
      provider,
      status: historyStatus,
      rollbackStatus: historyRollbackStatus,
      limit: 4,
    }) as any;
    if (history?.evidence) setEvidenceHistory(history.evidence);
    const decisionData = await getReleaseDecisions({ stream, provider, limit: 4 }) as any;
    if (decisionData?.decisions) setDecisions(decisionData.decisions);
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

  const compareProviders = async () => {
    setError(null);
    const data = await compareReleaseEvidence({ stream, providers: 'local-docker,railway,render' }) as any;
    if (data?.comparison) setComparison(data.comparison);
  };

  const recordDecision = async () => {
    const latestEvidence = evidenceHistory[0];
    if (!latestEvidence) {
      setError('No release evidence record is available for decision capture.');
      return;
    }
    setError(null);
    const data = await createReleaseDecision({
      evidenceId: latestEvidence.id,
      decision,
      reason: decisionReason,
      decidedBy: 'operator',
    }) as any;
    if (data?.decision) setDecisions([data.decision, ...decisions].slice(0, 4));
  };

  const reconcileDecision = async () => {
    const latestDecision = decisions[0];
    if (!latestDecision) {
      setError('Record a release decision before reconciling commit metadata.');
      return;
    }
    if (!commitSha.trim() || !branchName.trim()) {
      setError('Commit SHA and branch are required for release reconciliation.');
      return;
    }
    setError(null);
    const data = await createReleaseReconciliation({
      decisionId: latestDecision.id,
      commitSha: commitSha.trim(),
      branch: branchName.trim(),
      pullRequestUrl: pullRequestUrl.trim() || undefined,
      initiatedBy: 'operator',
    }) as any;
    if (data?.reconciliation) {
      const summary = await getReleaseBundleSummary({ decisionId: latestDecision.id, limit: 8 }) as any;
      if (summary?.bundle) setBundle(summary.bundle);
    }
  };

  const loadBundleSummary = async () => {
    setError(null);
    const latestDecision = decisions[0];
    const data = await getReleaseBundleSummary({
      decisionId: latestDecision?.id,
      stream,
      provider,
      limit: 8,
    }) as any;
    if (data?.bundle) {
      setBundle(data.bundle);
      setDrift(data.bundle.drift);
    }
  };

  const checkDrift = async () => {
    const latestDecision = decisions[0];
    if (!latestDecision) {
      setError('Record a release decision before checking post-release drift.');
      return;
    }
    setError(null);
    const data = await getReleaseDrift({ decisionId: latestDecision.id }) as any;
    if (data?.drift) setDrift(data.drift);
  };

  const planRetention = async () => {
    setError(null);
    const data = await applyReleaseEvidenceRetention({
      stream,
      provider,
      retainLatest,
      dryRun: true,
    }) as any;
    if (data?.retention) setRetention(data.retention);
  };

  useEffect(() => {
    loadReleaseReadiness();
  }, []);

  return (
    <div style={{ background: '#12172B', borderRadius: 8, padding: 24, border: '1px solid #1E293B', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: '#94A3B8', fontSize: 14, marginTop: 0, marginBottom: 6 }}>Phase 10 Release Closure</h2>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            Runtime gates, decision reconciliation, bundle summary, retention planning, and post-release drift.
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
        <select value={historyStatus} onChange={event => setHistoryStatus(event.target.value)} style={inputStyle}>
          <option value="">any status</option>
          <option value="ready">ready</option>
          <option value="degraded">degraded</option>
          <option value="blocked">blocked</option>
        </select>
        <select value={historyRollbackStatus} onChange={event => setHistoryRollbackStatus(event.target.value)} style={inputStyle}>
          <option value="">any rollback</option>
          <option value="ready">rollback ready</option>
          <option value="degraded">rollback degraded</option>
          <option value="blocked">rollback blocked</option>
        </select>
        <button onClick={loadReleaseReadiness} disabled={loading || !stream.trim()} style={buttonStyle(loading || !stream.trim())}>
          Check Gate
        </button>
        <button onClick={exportReleaseEvidence} disabled={loading || !stream.trim()} style={buttonStyle(loading || !stream.trim())}>
          Export JSON
        </button>
        <button onClick={compareProviders} disabled={loading || !stream.trim()} style={buttonStyle(loading || !stream.trim())}>
          Compare
        </button>
        <button onClick={loadBundleSummary} disabled={loading || !stream.trim()} style={buttonStyle(loading || !stream.trim())}>
          Bundle
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

      {comparison && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          <div style={panelTitleStyle}>Provider Checksum Comparison</div>
          <div style={{ color: comparison.allMatched ? '#A3E635' : '#FDBA74', fontSize: 12, marginBottom: 8 }}>
            {comparison.allMatched ? 'All provider evidence checksums match.' : 'Provider evidence requires review.'}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {comparison.records.map(record => (
              <div key={record.provider} style={{ display: 'grid', gridTemplateColumns: '96px 76px 1fr', gap: 10, color: '#CBD5E1', fontSize: 11 }}>
                <span>{record.provider}</span>
                <span style={{ color: record.missing ? '#EF4444' : statusColor(record.status) }}>{record.missing ? 'missing' : record.status}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.evidenceChecksum || 'no checksum'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {evidenceHistory.length > 0 && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          <div style={panelTitleStyle}>Release Decision</div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 118px', gap: 10 }}>
            <select value={decision} onChange={event => setDecision(event.target.value as ReleaseDecisionOutcome)} style={inputStyle}>
              <option value="go">go</option>
              <option value="no-go">no-go</option>
              <option value="exception">exception</option>
            </select>
            <input value={decisionReason} onChange={event => setDecisionReason(event.target.value)} style={inputStyle} />
            <button onClick={recordDecision} disabled={loading || !decisionReason.trim()} style={buttonStyle(loading || !decisionReason.trim())}>
              Record
            </button>
          </div>
          {decisions.length > 0 && (
            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              {decisions.map(item => (
                <div key={item.id} style={{ color: '#CBD5E1', fontSize: 11 }}>
                  <strong style={{ color: item.decision === 'go' ? '#A3E635' : '#FDBA74' }}>{item.decision}</strong> by {item.decidedBy}: {item.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {decisions.length > 0 && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          <div style={panelTitleStyle}>Decision Reconciliation</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))', gap: 10 }}>
            <input value={commitSha} onChange={event => setCommitSha(event.target.value)} placeholder="Commit SHA" style={inputStyle} />
            <input value={branchName} onChange={event => setBranchName(event.target.value)} placeholder="Branch" style={inputStyle} />
            <input value={pullRequestUrl} onChange={event => setPullRequestUrl(event.target.value)} placeholder="PR URL" style={inputStyle} />
            <button onClick={reconcileDecision} disabled={loading || !commitSha.trim() || !branchName.trim()} style={buttonStyle(loading || !commitSha.trim() || !branchName.trim())}>
              Reconcile
            </button>
            <button onClick={checkDrift} disabled={loading} style={buttonStyle(loading)}>
              Drift
            </button>
          </div>
        </div>
      )}

      <div style={{ ...panelStyle, marginTop: 12 }}>
        <div style={panelTitleStyle}>Evidence Retention</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
          <input
            type="number"
            min={1}
            max={500}
            value={retainLatest}
            onChange={event => setRetainLatest(Number(event.target.value))}
            style={inputStyle}
          />
          <button onClick={planRetention} disabled={loading || !stream.trim()} style={buttonStyle(loading || !stream.trim())}>
            Plan Retention
          </button>
        </div>
        {retention && (
          <div style={{ color: '#CBD5E1', fontSize: 11, marginTop: 10 }}>
            Retaining {retention.retainLatest}; {retention.candidateCount} candidate records; checksum {retention.retentionChecksum}.
          </div>
        )}
      </div>

      {bundle && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          <div style={panelTitleStyle}>Release Bundle Summary</div>
          <div style={{ color: bundle.summary.releaseReady ? '#A3E635' : '#FDBA74', fontSize: 12, marginBottom: 8 }}>
            {bundle.summary.recommendation}
          </div>
          <div style={{ display: 'grid', gap: 6, color: '#CBD5E1', fontSize: 11 }}>
            <div>Decision: {bundle.decision.decision} | Reconciliation: {bundle.summary.reconciliationState}</div>
            <div>Drift: {bundle.drift.status} | Evidence retained: {bundle.summary.evidenceRetained}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Bundle checksum: {bundle.bundleChecksum}</div>
          </div>
        </div>
      )}

      {drift && (
        <div style={{ ...panelStyle, marginTop: 12, borderColor: statusColor(drift.status === 'ready' ? 'ready' : 'degraded') }}>
          <div style={panelTitleStyle}>Post-Release Drift</div>
          <div style={{ color: drift.status === 'ready' ? '#A3E635' : '#FDBA74', fontSize: 12 }}>
            {drift.status === 'ready' ? 'Accepted decision signature still matches current monitor evidence.' : drift.alerts.join(' ')}
          </div>
          <div style={{ color: '#64748B', fontSize: 11, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Drift checksum: {drift.driftChecksum}
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
