// ─── AnalysisPanel ──────────────────────────────────────────────────────────
// Displays BPM, key, confidence, and analysis progress.
// Phase 2 component — surfaces DSP analysis results.

import type { TrackAnalysis } from '../types/audio';

interface AnalysisPanelProps {
  analysis: TrackAnalysis | null;
  progress: { stage: string; percent: number } | null;
}

const STAGE_LABELS: Record<string, string> = {
  fft: 'Spectral Analysis',
  bpm: 'BPM Detection',
  chroma: 'Key Estimation',
  transients: 'Transient Detection',
  symbolic: 'Symbolic Extraction',
};

function ConfidenceMeter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = value > 0.6 ? '#22D3EE' : value > 0.3 ? '#FBBF24' : '#EF4444';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: '#64748B', width: 64, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: 4,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: 10, color: '#64748B', width: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export function AnalysisPanel({ analysis, progress }: AnalysisPanelProps) {
  // Show progress state while analyzing
  if (progress && !analysis) {
    return (
      <div style={{
        background: 'rgba(124, 58, 237, 0.05)',
        border: '1px solid rgba(124, 58, 237, 0.2)',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{
          fontSize: 11,
          color: '#7c3aed',
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          fontFamily: 'JetBrains Mono, monospace',
          marginBottom: 12,
        }}>
          ⏳ Analyzing...
        </div>
        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8 }}>
          {STAGE_LABELS[progress.stage] ?? progress.stage}
        </div>
        <div style={{
          height: 4,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress.percent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #7c3aed, #22D3EE)',
            borderRadius: 2,
            transition: 'width 0.15s ease',
          }} />
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid #1E293B',
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{
        fontSize: 11,
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontFamily: 'JetBrains Mono, monospace',
        marginBottom: 16,
      }}>
        Track Analysis
      </div>

      {/* Main metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 16,
        marginBottom: 16,
      }}>
        {/* BPM */}
        <div style={{
          background: 'rgba(124, 58, 237, 0.08)',
          border: '1px solid rgba(124, 58, 237, 0.2)',
          borderRadius: 8,
          padding: '12px 16px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#A78BFA',
            lineHeight: 1,
          }}>
            {analysis.bpm}
          </div>
          <div style={{
            fontSize: 10,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: 4,
          }}>
            BPM
          </div>
        </div>

        {/* Key */}
        <div style={{
          background: 'rgba(34, 211, 238, 0.08)',
          border: '1px solid rgba(34, 211, 238, 0.2)',
          borderRadius: 8,
          padding: '12px 16px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#22D3EE',
            lineHeight: 1,
          }}>
            {analysis.key.split(' ')[0]}
          </div>
          <div style={{
            fontSize: 10,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: 4,
          }}>
            {analysis.key.split(' ').slice(1).join(' ') || 'key'}
          </div>
        </div>

        {/* Beat Grid */}
        <div style={{
          background: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.2)',
          borderRadius: 8,
          padding: '12px 16px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#FBBF24',
            lineHeight: 1,
          }}>
            {analysis.beatGrid.length}
          </div>
          <div style={{
            fontSize: 10,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: 4,
          }}>
            Beats
          </div>
        </div>
      </div>

      {/* Confidence meters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ConfidenceMeter value={analysis.bpmConfidence} label="BPM" />
        <ConfidenceMeter value={analysis.keyConfidence} label="Key" />
      </div>
    </div>
  );
}
