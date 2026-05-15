/**
 * Oscilloscope.tsx — Standalone neon-glow waveform visualizer.
 *
 * Reads directly from the SharedRingBuffer via useDSP().sabViews using
 * Atomics.load (peek-only, never advances READ_HEAD). Renders at 60fps
 * via requestAnimationFrame with phosphor persistence.
 *
 * Style: Neon Cyan (#00ffff) stroke on black background.
 * Features: zero-crossing trigger, bloom double-pass, underrun indicator.
 */

import React, { useRef, useEffect } from 'react';
import { useDSP, type SabViews } from '../dsp/DSPContext';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const SCOPE_SAMPLES = 512;

/* ─── Component ──────────────────────────────────────────────────────────── */

interface OscilloscopeProps {
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

const Oscilloscope: React.FC<OscilloscopeProps> = ({
  width = 292,
  height = 108,
  style,
}) => {
  const { sabViews } = useDSP();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  // Keep sabViews in a mutable ref so the RAF closure always sees the latest
  const viewsRef  = useRef<SabViews | null>(null);

  useEffect(() => {
    viewsRef.current = sabViews;
  }, [sabViews]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      const views = viewsRef.current;
      const W = canvas!.width;
      const H = canvas!.height;

      /* Phosphor persistence — 80% fade instead of hard clear */
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx!.fillRect(0, 0, W, H);

      /* Grid lines */
      ctx!.strokeStyle = 'rgba(0, 40, 40, 0.7)';
      ctx!.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(f => {
        ctx!.beginPath(); ctx!.moveTo(0, f * H); ctx!.lineTo(W, f * H); ctx!.stroke();
        ctx!.beginPath(); ctx!.moveTo(f * W, 0); ctx!.lineTo(f * W, H); ctx!.stroke();
      });
      /* Zero-line slightly brighter */
      ctx!.strokeStyle = 'rgba(0, 60, 60, 0.9)';
      ctx!.beginPath(); ctx!.moveTo(0, H / 2); ctx!.lineTo(W, H / 2); ctx!.stroke();

      if (!views) {
        /* No engine — draw idle label */
        ctx!.fillStyle = 'rgba(0, 255, 255, 0.15)';
        ctx!.font = '9px JetBrains Mono, monospace';
        ctx!.fillText('ENGINE IDLE', 6, H - 6);
        return;
      }

      const wh = Atomics.load(views.heads, 0);
      const n  = Math.min(SCOPE_SAMPLES, views.capacity);

      /* Zero-crossing trigger: first positive-going crossing for stable display */
      let offset = 0;
      for (let i = 1; i < n - 1; i++) {
        const prev = views.data[((wh - n + i - 1) >>> 0) & views.mask];
        const curr = views.data[((wh - n + i)     >>> 0) & views.mask];
        if (prev <= 0 && curr > 0) { offset = i; break; }
      }
      const drawN = n - offset;

      /* Build path once — reuse for glow and bright pass */
      const buildPath = () => {
        ctx!.beginPath();
        for (let i = 0; i < drawN; i++) {
          const idx = ((wh - n + offset + i) >>> 0) & views!.mask;
          const s   = views!.data[idx];
          const x   = (i / (drawN - 1)) * W;
          const y   = H / 2 - s * (H / 2 - 6);
          i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
      };

      /* Pass 1 — wide neon bloom */
      buildPath();
      ctx!.strokeStyle = 'rgba(0, 255, 255, 0.18)';
      ctx!.lineWidth = 8;
      ctx!.shadowBlur = 0;
      ctx!.stroke();

      /* Pass 2 — bright #00ffff center line */
      buildPath();
      ctx!.strokeStyle = '#00ffff';
      ctx!.lineWidth = 1.5;
      ctx!.shadowBlur = 14;
      ctx!.shadowColor = '#00ffff';
      ctx!.stroke();
      ctx!.shadowBlur = 0;

      /* RMS level bar at bottom */
      let rms = 0;
      for (let i = 0; i < drawN; i++) {
        const s = views.data[((wh - n + offset + i) >>> 0) & views.mask];
        rms += s * s;
      }
      rms = Math.sqrt(rms / drawN);
      const barW = Math.min(rms * W * 2.2, W);
      ctx!.shadowBlur = 0;
      ctx!.fillStyle = rms > 0.45 ? '#ff2020' : rms > 0.15 ? '#00ffff' : '#003f3f';
      ctx!.fillRect(0, H - 3, barW, 3);

      /* Underrun indicator: if buffer is consistently silent, warn */
      let allZero = true;
      for (let i = 0; i < Math.min(64, drawN); i++) {
        const idx = ((wh - n + offset + i) >>> 0) & views.mask;
        if (Math.abs(views.data[idx]) > 1e-4) { allZero = false; break; }
      }
      if (allZero) {
        ctx!.fillStyle = 'rgba(255, 60, 60, 0.7)';
        ctx!.font = '9px JetBrains Mono, monospace';
        ctx!.fillText('NO SIGNAL', 6, H - 8);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        background: '#000',
        border: '1px solid #001a1a',
        borderRadius: 3,
        ...style,
      }}
    />
  );
};

export default Oscilloscope;
