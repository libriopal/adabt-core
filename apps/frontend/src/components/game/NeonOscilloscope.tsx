// ─────────────────────────────────────────────────────
// DREAM-CORE — Neon Oscilloscope Component
// Real-time audio visualization via requestAnimationFrame.
// No React re-renders per frame — canvas draws directly.
// ─────────────────────────────────────────────────────

import React, { useRef, useEffect, useCallback } from 'react';
import { dreamAudio } from '../../../../../packages/dream-core/src/audio/DreamAudioEngine';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';

interface NeonOscilloscopeProps {
  width?: number;
  height?: number;
  className?: string;
}

export const NeonOscilloscope: React.FC<NeonOscilloscopeProps> = ({
  width = 400,
  height = 80,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Initialize analyser node
  useEffect(() => {
    const ctx = dreamAudio.init();

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    // Connect to destination for monitoring (tap into master)
    // In a real setup, this would tap the master gain
    return () => {
      analyserRef.current = null;
    };
  }, []);

  // Canvas draw loop — no React re-renders
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const data = dataRef.current;
    if (!canvas || !analyser || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    analyser.getByteTimeDomainData(data);

    // Get current state without causing re-render
    const volatility = useDreamStore.getState().volatility;
    const heartbeat = useDreamStore.getState().heartbeat;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, w, h);

    // Scanlines
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.06)';
    ctx.setLineDash([2, 4]);
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Waveform — color shifts with volatility
    const amplitude = volatility.surgeActive ? 1.5 : 1.0;
    const hue = heartbeat.active ? 0 : (volatility.standardDeviation * 2 + 180);

    ctx.beginPath();
    ctx.strokeStyle = heartbeat.active
      ? `rgba(255, 50, 50, 0.9)`
      : `hsla(${hue}, 100%, 50%, 0.8)`;
    ctx.lineWidth = 2;
    ctx.shadowColor = heartbeat.active ? '#ff3333' : `hsl(${hue}, 100%, 50%)`;
    ctx.shadowBlur = 8;

    const sliceWidth = w / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = (data[i]! / 128.0 - 1.0) * amplitude;
      const y = h / 2 + v * (h / 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center line (reference)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div className={`oscilloscope ${className}`}>
      <canvas
        ref={canvasRef}
        width={width * 2}
        height={height * 2}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          imageRendering: 'auto',
        }}
      />
    </div>
  );
};
