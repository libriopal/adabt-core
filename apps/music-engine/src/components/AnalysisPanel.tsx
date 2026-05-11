// ─── AnalysisPanel ──────────────────────────────────────────────────────────
// Displays BPM, key, analysis progress, and spectral feature timeline.
// Phase 2 — core analysis results UI.

import { useRef, useEffect, useCallback } from 'react';
import type { AnalysisResult, AnalysisStatus, AnalysisStage } from '../types/audio';

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  status: AnalysisStatus;
  duration: number;
  currentTime: number;
}

const STAGE_LABELS: Record<AnalysisStage, string> = {
  fft: 'Computing STFT',
  bpm: 'Detecting BPM',
  chroma: 'Extracting Chroma',
  transients: 'Building Beat Grid',
  symbolic: 'Symbolic Extraction',
};

export function AnalysisPanel({ analysis, status, duration, currentTime }: AnalysisPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw energy timeline with beat markers
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = '#0d0d15';
    ctx.fillRect(0, 0, w, h);

    if (analysis.frames.length === 0 || duration <= 0) return;

    // Draw spectral centroid as a filled area
    ctx.beginPath();
    ctx.moveTo(0, h);
    let maxCentroid = 0;
    for (const f of analysis.frames) {
      if (f.spectralCentroid > maxCentroid) maxCentroid = f.spectralCentroid;
    }

    for (let i = 0; i < analysis.frames.length; i++) {
      const f = analysis.frames[i];
      const x = (f.time / duration) * w;
      const y = h - (maxCentroid > 0 ? (f.spectralCentroid / maxCentroid) : 0) * h * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.fill();

    // Draw RMS energy bars
    const barW = Math.max(1, w / analysis.frames.length);
    for (let i = 0; i < analysis.frames.length; i++) {
      const f = analysis.frames[i];
      const x = (f.time / duration) * w;
      const barH = f.rms * h * 3; // Scale for visibility

      const gradient = ctx.createLinearGradient(x, h - barH, x, h);
      gradient.addColorStop(0, 'rgba(124, 58, 237, 0.6)');
      gradient.addColorStop(1, 'rgba(124, 58, 237, 0.1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, h - barH, barW, barH);
    }

    // Draw beat grid lines
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
    ctx.lineWidth = 1;
    for (const beatTime of analysis.beatGrid) {
      const x = (beatTime / duration) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Draw onset flux as thin spikes
    let maxFlux = 0;
    for (const f of analysis.frames) {
      if (f.spectralFlux > maxFlux) maxFlux = f.spectralFlux;
    }
    if (maxFlux > 0) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 0.5;
      for (const f of analysis.frames) {
        const x = (f.time / duration) * w;
        const spikeH = (f.spectralFlux / maxFlux) * h * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, h - spikeH);
        ctx.stroke();
      }
    }

    // Playhead
    if (duration > 0) {
      const playX = (currentTime / duration) * w;
      ctx.strokeStyle = '#e0e0e8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, h);
      ctx.stroke();
    }
  }, [analysis, duration, currentTime]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ─── Render ─────────────────────────────────────────────────────────────

  // Loading state
  if (status.active) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid #222',
        borderRadius: 8,
        padding: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
            Analyzing
          </div>
          <div style={{ fontSize: 12, color: '#a78bfa' }}>
            {status.stage ? STAGE_LABELS[status.stage] : 'Initializing'}
          </div>
        </div>
        <div style={{
          width: '100%',
          height: 4,
          background: '#1a1a2e',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${status.percent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
            borderRadius: 2,
            transition: 'width 0.15s ease',
          }} />
        </div>
      </div>
    );
  }

  // No results yet
  if (!analysis) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Key metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
      }}>
        {/* BPM */}
        <div style={{
          background: 'rgba(124, 58, 237, 0.08)',
          border: '1px solid rgba(124, 58, 237, 0.2)',
          borderRadius: 8,
          padding: '10px 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            BPM
          </div>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#a78bfa',
            fontFeatureSettings: '"tnum"',
            lineHeight: 1.2,
          }}>
            {Math.round(analysis.bpm)}
          </div>
        </div>

        {/* Key */}
        <div style={{
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          borderRadius: 8,
          padding: '10px 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            Key
          </div>
          <div style={{
            fontSize: 20,
            fontWeight: 600,
            color: '#06b6d4',
            lineHeight: 1.4,
          }}>
            {analysis.key}
          </div>
        </div>

        {/* Beats */}
        <div style={{
          background: 'rgba(250, 204, 21, 0.06)',
          border: '1px solid rgba(250, 204, 21, 0.15)',
          borderRadius: 8,
          padding: '10px 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            Beats
          </div>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#facc15',
            fontFeatureSettings: '"tnum"',
            lineHeight: 1.2,
          }}>
            {analysis.beatGrid.length}
          </div>
        </div>

        {/* Frames */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid #222',
          borderRadius: 8,
          padding: '10px 14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            Frames
          </div>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#a0a0b0',
            fontFeatureSettings: '"tnum"',
            lineHeight: 1.2,
          }}>
            {analysis.frames.length}
          </div>
        </div>
      </div>

      {/* Energy + Beat Timeline */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid #222',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px 4px',
        }}>
          <span style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
            Energy + Beat Grid
          </span>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 10, color: '#7c3aed' }}>■ RMS</span>
            <span style={{ fontSize: 10, color: '#06b6d4' }}>■ Centroid</span>
            <span style={{ fontSize: 10, color: '#facc15' }}>│ Beats</span>
            <span style={{ fontSize: 10, color: '#ef4444' }}>│ Onsets</span>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 100,
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}
