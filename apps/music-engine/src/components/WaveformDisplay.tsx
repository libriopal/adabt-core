// ─── WaveformDisplay ────────────────────────────────────────────────────────
// Renders a waveform preview from the decoded PCM data.
// Phase 2: Beat grid overlay markers drawn on top of waveform.
// Uses canvas for efficient rendering. Supports seek-by-click.

import { useRef, useEffect, useCallback } from 'react';

interface WaveformDisplayProps {
  waveform: Float32Array | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  beatGrid?: number[] | null;
}

export function WaveformDisplay({
  waveform,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  beatGrid,
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;
    const playheadX = duration > 0 ? (currentTime / duration) * w : 0;

    // Background
    ctx.fillStyle = '#0d0d15';
    ctx.fillRect(0, 0, w, h);

    // Beat grid markers (draw behind waveform for depth)
    if (beatGrid && beatGrid.length > 0 && duration > 0) {
      for (let i = 0; i < beatGrid.length; i++) {
        const x = (beatGrid[i] / duration) * w;
        // Downbeat (every 4th beat) gets a brighter line
        const isDownbeat = i % 4 === 0;
        ctx.strokeStyle = isDownbeat
          ? 'rgba(250, 204, 21, 0.25)'
          : 'rgba(250, 204, 21, 0.10)';
        ctx.lineWidth = isDownbeat ? 1.5 : 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        // Small tick at top for downbeats
        if (isDownbeat) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.4)';
          ctx.fillRect(x - 1, 0, 3, 4);
        }
      }
    }

    // Waveform bars
    const barWidth = Math.max(1, w / waveform.length);
    for (let i = 0; i < waveform.length; i++) {
      const x = (i / waveform.length) * w;
      const amplitude = waveform[i] * mid * 0.9;

      const isPast = x < playheadX;
      ctx.fillStyle = isPast
        ? 'rgba(124, 58, 237, 0.8)'
        : 'rgba(160, 160, 176, 0.3)';

      ctx.fillRect(x, mid - amplitude, barWidth + 0.5, amplitude * 2);
    }

    // Playhead
    if (duration > 0) {
      ctx.strokeStyle = '#e0e0e8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();
    }
  }, [waveform, currentTime, duration, beatGrid]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.min(duration, Math.max(0, (x / rect.width) * duration));
    onSeek(time);
  }, [duration, onSeek]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: 120, borderRadius: 8, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          width: '100%',
          height: '100%',
          cursor: duration > 0 ? 'pointer' : 'default',
          display: 'block',
        }}
      />
    </div>
  );
}
