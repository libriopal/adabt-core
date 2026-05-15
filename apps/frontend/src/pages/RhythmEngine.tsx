/**
 * RhythmEngine.tsx — Inverted Guitar Hero game page.
 *
 * This component is a pure renderer and input handler.
 * All game logic, frequency math, and emotional state live in the
 * RhythmEngine singleton (src/engine/RhythmEngine.ts).
 *
 * Data flow:
 *   RhythmEngine singleton ─── update(dt) ───► mutates game state
 *   RAF loop               ─── reads state  ───► draws to canvas
 *   Pointer events         ─── tryPointerCatch ► singleton handles catch
 *   useDSP()               ─── setFreq/setGain ► WASM kernel
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useDSP } from '../dsp/DSPContext';
import { RhythmEngine } from '../engine/RhythmEngine';
import type { FreqBlock } from '../engine/RhythmEngine';

/* ─── Frequency ↔ Canvas Y helpers ──────────────────────────────────────── */

const MIN_FREQ = 60;
const MAX_FREQ = 1800;
const LOG_MIN  = Math.log(MIN_FREQ);
const LOG_MAX  = Math.log(MAX_FREQ);

function freqToY(freq: number, H: number): number {
  const t = (Math.log(Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq))) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return H * (1 - t);
}

/* ─── Drawing ────────────────────────────────────────────────────────────── */

const FREQ_MARKERS = [80, 120, 200, 320, 500, 800, 1200, 1600];
const BLOCK_W = 76;
const BLOCK_H = 28;

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): void {
  const { blocks, health, score, emotion, currentFreq } = RhythmEngine;

  /* Background */
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, W, H);

  /* Frequency axis grid lines */
  ctx.font = '9px JetBrains Mono, monospace';
  FREQ_MARKERS.forEach(f => {
    const y = freqToY(f, H);
    ctx.strokeStyle = 'rgba(14, 28, 52, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.fillStyle = '#1a3050';
    ctx.fillText(`${f}Hz`, 4, y - 3);
  });

  /* Current frequency indicator — glowing horizontal line */
  const curY = freqToY(currentFreq, H);
  const healthNorm = Math.max(0, health / 100);

  /* Emotion-aware color */
  const lineColor = emotion === 'tension' ? `hsla(0,100%,60%,${healthNorm})`
                  : emotion === 'flow'    ? `hsla(160,100%,60%,${healthNorm})`
                  : `hsla(180,100%,60%,${healthNorm})`;

  ctx.save();
  ctx.shadowBlur = 18 * healthNorm;
  ctx.shadowColor = lineColor;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(0, curY); ctx.lineTo(W, curY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* Freq label */
  ctx.fillStyle = lineColor;
  ctx.font = 'bold 11px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(currentFreq)}Hz`, W - 6, curY - 5);
  ctx.textAlign = 'left';

  /* Blocks */
  blocks.forEach((b: FreqBlock) => {
    if (b.caught && b.burstTimer <= 0) return;

    if (b.burstTimer > 0) {
      /* Burst ring animation */
      const t = b.burstTimer / 350;
      const r = 28 + (1 - t) * 45;
      ctx.save();
      ctx.globalAlpha = t * 0.85;
      ctx.shadowBlur = 28 * t;
      ctx.shadowColor = `hsl(${b.hue}, 100%, 70%)`;
      ctx.strokeStyle = `hsl(${b.hue}, 100%, 70%)`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      return;
    }

    /* Block body */
    const bx = b.x - BLOCK_W / 2;
    const by = b.y - BLOCK_H / 2;
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = `hsl(${b.hue}, 100%, 55%)`;
    ctx.strokeStyle = `hsl(${b.hue}, 100%, 55%)`;
    ctx.fillStyle   = `hsla(${b.hue}, 80%, 10%, 0.92)`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, BLOCK_W, BLOCK_H, 5); ctx.fill(); ctx.stroke();
    ctx.restore();

    /* Freq label inside block */
    ctx.fillStyle = `hsl(${b.hue}, 90%, 80%)`;
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(b.targetFreq)}Hz`, b.x, b.y + 4);
    ctx.textAlign = 'left';
  });

  /* Health bar */
  const healthHue = health > 50 ? 140 : health > 25 ? 45 : 0;
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, W, 5);
  ctx.shadowBlur = health > 25 ? 6 : 0;
  ctx.shadowColor = `hsl(${healthHue}, 90%, 50%)`;
  ctx.fillStyle   = `hsl(${healthHue}, 90%, 50%)`;
  ctx.fillRect(0, 0, W * (health / 100), 5);
  ctx.shadowBlur = 0;

  /* HUD */
  ctx.fillStyle = '#2a4060';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillText(`HEALTH ${Math.round(health)}%  |  ${emotion.toUpperCase()}`, 8, 20);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(`SCORE ${score}`, W - 8, 20);
  ctx.textAlign = 'left';

  /* Start hint */
  if (score === 0 && blocks.length === 0) {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.5)';
    ctx.font = '13px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('START ENGINE — catch the falling frequency nodes', W / 2, H / 2);
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(34,211,238,0.3)';
    ctx.fillText('tap / click a block to lock its frequency into the tone', W / 2, H / 2 + 22);
    ctx.fillText('3 perfect catches → Flow state  |  misses → Tension', W / 2, H / 2 + 40);
    ctx.textAlign = 'left';
  }
}

/* ─── Component ──────────────────────────────────────────────────────────── */

const RhythmEnginePage: React.FC = () => {
  const { setFreq, setGain, running } = useDSP();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const lastTsRef  = useRef<number>(0);
  const runningRef = useRef(running);

  useEffect(() => { runningRef.current = running; }, [running]);

  /* ── Canvas resize ─────────────────────────────────────────────────── */

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width  = rect.width;
    canvas.height = rect.height;
    RhythmEngine.canvasW = rect.width;
    RhythmEngine.canvasH = rect.height;
  }, []);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvasRef.current!.parentElement!);
    return () => ro.disconnect();
  }, [resize]);

  /* ── Init singleton with audio callbacks ───────────────────────────── */

  useEffect(() => {
    RhythmEngine.init({ setFreq, setGain });
  }, [setFreq, setGain]);

  /* ── Activate / deactivate singleton when engine starts/stops ──────── */

  useEffect(() => {
    RhythmEngine.setActive(running);
    if (running) {
      RhythmEngine.reset();
      RhythmEngine.canvasW = canvasRef.current?.width  ?? 0;
      RhythmEngine.canvasH = canvasRef.current?.height ?? 0;
      setFreq(440);
      setGain(0.8);
    } else {
      setGain(0);
    }
  }, [running, setFreq, setGain]);

  /* ── RAF game loop — update singleton, then draw ───────────────────── */

  useEffect(() => {
    function frame(ts: number) {
      rafRef.current = requestAnimationFrame(frame);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dt = Math.min((ts - (lastTsRef.current || ts)) / 1000, 0.05);
      lastTsRef.current = ts;

      if (runningRef.current) {
        RhythmEngine.update(dt, ts);
      }

      drawFrame(ctx, canvas.width, canvas.height);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ── Pointer catch ─────────────────────────────────────────────────── */

  const handlePointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!runningRef.current) return;
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    RhythmEngine.tryPointerCatch(px, py);
  }, []);

  return (
    <div style={S.root}>
      <canvas
        ref={canvasRef}
        style={S.canvas}
        onPointerDown={handlePointer}
      />
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#050810',
    overflow: 'hidden',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
    cursor: 'crosshair',
    touchAction: 'none',
  },
};

export default RhythmEnginePage;
