// ─────────────────────────────────────────────────────
// DREAM-CORE — Beat Highway Component
// Scrolling beat markers synced to the audio clock.
// Player must roll on the beat for bonuses.
// ─────────────────────────────────────────────────────

import React, { useRef, useEffect, useCallback } from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import { generateBeatMarkers } from '../../../../../packages/dream-core/src/genres/rhythm';

interface BeatHighwayProps {
  width?: number;
  className?: string;
}

export const BeatHighway: React.FC<BeatHighwayProps> = ({
  width = 400,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = useDreamStore.getState();
    const { rhythm, slipstream, diceClass } = state;
    const now = Date.now();

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);

    // Hit zone (right side)
    const hitZoneWidth = 24;
    ctx.fillStyle = 'rgba(0, 255, 255, 0.06)';
    ctx.fillRect(w - hitZoneWidth, 0, hitZoneWidth, h);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - hitZoneWidth, 0);
    ctx.lineTo(w - hitZoneWidth, h);
    ctx.stroke();

    // Generate visible beat markers
    const visibleWindowMs = 3000; // show 3 seconds ahead
    const markers = generateBeatMarkers(
      rhythm.bpm,
      state.matchStartedAt,
      now,
      visibleWindowMs,
    );

    // Effective beat window for visualization
    const beatWindowMod = slipstream.beatWindowModifier;
    const classMod = diceClass.selectedClass === 'BARD' ? 30 : 0;
    const effectiveWindow = (rhythm.beatWindowMs * beatWindowMod + classMod) / 1000;

    // Draw beat markers
    for (const marker of markers) {
      const timeUntilBeat = marker.timeMs - now;
      const x = (1 - timeUntilBeat / visibleWindowMs) * (w - hitZoneWidth);

      if (x < 0 || x > w) continue;

      const isCurrent = Math.abs(timeUntilBeat) < 50;
      const isNear = Math.abs(timeUntilBeat) < effectiveWindow * 1000;

      ctx.fillStyle = isCurrent
        ? '#ff00ff'
        : isNear
          ? 'rgba(0, 255, 255, 0.8)'
          : 'rgba(0, 255, 255, 0.3)';

      const markerWidth = isCurrent ? 6 : 4;
      ctx.fillRect(x - markerWidth / 2, 0, markerWidth, h);

      if (isCurrent) {
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 12;
        ctx.fillRect(x - markerWidth / 2, 0, markerWidth, h);
        ctx.shadowBlur = 0;
      }
    }

    // Combo streak indicator
    if (rhythm.comboStreak > 0) {
      ctx.font = '10px monospace';
      ctx.fillStyle = rhythm.comboStreak >= 5
        ? '#ff00ff'
        : rhythm.comboStreak >= 3
          ? '#ffaa00'
          : '#00ffff';
      ctx.textAlign = 'left';
      ctx.fillText(`STREAK: ${rhythm.comboStreak}`, 8, 14);
    }

    // Flow multiplier
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(224, 224, 232, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(`FLOW: ×${rhythm.flowMultiplier.toFixed(2)}`, w - 8, 14);

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div className={`beat-highway ${className}`}>
      <canvas
        ref={canvasRef}
        width={width * 2}
        height={80}
        style={{
          width: `${width}px`,
          height: '40px',
          imageRendering: 'auto',
        }}
      />
    </div>
  );
};
