// ─── SpectrumVisualizer ─────────────────────────────────────────────────────
// Real-time frequency spectrum bars driven by VFX snapshots.
// Canvas-based, zero-allocation in the render loop.

import { useRef, useEffect } from 'react';
import type { VFXSnapshot } from '../types/audio';

interface SpectrumVisualizerProps {
  snapshot: VFXSnapshot | null;
  isPlaying: boolean;
}

export function SpectrumVisualizer({ snapshot, isPlaying }: SpectrumVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const snapshotRef = useRef<VFXSnapshot | null>(snapshot);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });

  // Keep snapshot ref in sync
  snapshotRef.current = snapshot;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Only resize canvas when dimensions actually change
      if (rect.width !== sizeRef.current.w || rect.height !== sizeRef.current.h || dpr !== sizeRef.current.dpr) {
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        sizeRef.current = { w: rect.width, h: rect.height, dpr };
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;

      // Background
      ctx.fillStyle = '#0d0d15';
      ctx.fillRect(0, 0, w, h);

      const snap = snapshotRef.current;
      if (!snap || !isPlaying) {
        // Draw idle state
        ctx.fillStyle = 'rgba(124, 58, 237, 0.15)';
        const numBars = 64;
        const barW = w / numBars;
        for (let i = 0; i < numBars; i++) {
          const barH = 2;
          ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
        }
        if (isPlaying) {
          rafRef.current = requestAnimationFrame(render);
        }
        return;
      }

      // Draw spectrum bars
      const spectrum = snap.spectrum;
      const numBars = Math.min(128, spectrum.length);
      const barWidth = w / numBars;

      for (let i = 0; i < numBars; i++) {
        // Use logarithmic frequency mapping for perceptual accuracy
        const freqIdx = Math.floor(Math.pow(i / numBars, 1.5) * spectrum.length);
        const value = spectrum[Math.min(freqIdx, spectrum.length - 1)];
        const barH = value * h * 0.9;

        // Color gradient: purple to cyan based on frequency
        const hue = 270 - (i / numBars) * 90; // 270 (purple) → 180 (cyan)
        const lightness = 40 + value * 30;
        ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;

        ctx.fillRect(
          i * barWidth + 1,
          h - barH,
          barWidth - 2,
          barH,
        );
      }

      // RMS energy bar at top
      const rmsWidth = snap.rms * w;
      const gradient = ctx.createLinearGradient(0, 0, rmsWidth, 0);
      gradient.addColorStop(0, 'rgba(124, 58, 237, 0.6)');
      gradient.addColorStop(1, 'rgba(167, 139, 250, 0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rmsWidth, 3);

      rafRef.current = requestAnimationFrame(render);
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(render);
    } else {
      render(); // Draw idle state once
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: 200,
        borderRadius: 8,
        display: 'block',
      }}
    />
  );
}
