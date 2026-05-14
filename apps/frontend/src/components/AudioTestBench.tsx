/**
 * AudioTestBench — Developer test harness for the WasmDSPKernel pipeline.
 *
 * Architecture:
 *   Web Worker (dsp-kernel.worker.ts)
 *     └─ WasmDSPKernel  →  SharedArrayBuffer  →  AudioWorkletProcessor
 *                                                       └─ AudioContext.destination
 *
 * The main thread reads WRITE_HEAD / READ_HEAD directly from the SAB using
 * Uint32Array atomic views, without advancing the consumer pointer.
 * The oscilloscope peeks at the Float32 data region the same way.
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ChangeEvent,
} from 'react';
import type { DeviceTier } from '../dsp/wasm/WasmDSPKernel.types';

/* ─── AudioWorklet processor (inlined as Blob URL) ───────────────────────── */

const WORKLET_CODE = `
class DspKernelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ready = false;
    this.port.onmessage = (e) => {
      const { sab, writeHeadPtr, dataPtr, capacity } = e.data;
      // Both WRITE_HEAD (index 0) and READ_HEAD (index 1) live in a contiguous
      // Uint32Array starting at writeHeadPtr (readHeadPtr = writeHeadPtr + 4).
      this._heads = new Uint32Array(sab, writeHeadPtr, 2);
      this._data  = new Float32Array(sab, dataPtr, capacity);
      this._mask  = capacity - 1;
      this._ready = true;
    };
  }

  process(_inputs, outputs) {
    const ch = outputs[0]?.[0];
    if (!ch) return true;
    const n = ch.length; // 128

    if (!this._ready) { ch.fill(0); return true; }

    const writeHead = Atomics.load(this._heads, 0); // acquire
    const readHead  = Atomics.load(this._heads, 1); // relaxed (we own READ_HEAD)
    const available = (writeHead - readHead) >>> 0;

    if (available < n) { ch.fill(0); return true; }

    const mask = this._mask, data = this._data;
    for (let i = 0; i < n; i++) ch[i] = data[(readHead + i) & mask];

    Atomics.store(this._heads, 1, (readHead + n) >>> 0); // relaxed
    return true;
  }
}
registerProcessor('dsp-kernel-processor', DspKernelProcessor);
`;

function makeWorkletBlobUrl(): string {
  const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Status = 'idle' | 'initializing' | 'running' | 'error';

interface SabViews {
  heads: Uint32Array;   // [WRITE_HEAD, READ_HEAD] at writeHeadPtr
  data: Float32Array;   // audio samples at dataPtr
  capacity: number;
  mask: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const SCOPE_SAMPLES = 512;
const CANVAS_W = 512;
const CANVAS_H = 128;

function drawOscilloscope(
  ctx: CanvasRenderingContext2D,
  views: SabViews,
): void {
  const { data, capacity, mask } = views;
  const writeHead = Atomics.load(views.heads, 0);

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid
  ctx.strokeStyle = '#1a3a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H / 2);
  ctx.lineTo(CANVAS_W, CANVAS_H / 2);
  ctx.stroke();

  // Waveform — peek at the last SCOPE_SAMPLES before writeHead
  const n = Math.min(SCOPE_SAMPLES, capacity);
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const sampleIdx = ((writeHead - n + i) >>> 0) & mask;
    const sample = data[sampleIdx];
    const x = (i / (n - 1)) * CANVAS_W;
    const y = CANVAS_H / 2 - sample * (CANVAS_H / 2 - 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // RMS volume meter (bottom bar)
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const s = data[((writeHead - n + i) >>> 0) & mask];
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / n);
  const meterW = rms * CANVAS_W * 2; // rms of full-scale sine ≈ 0.5
  ctx.fillStyle = rms > 0.4 ? '#ff4444' : '#00cc66';
  ctx.fillRect(0, CANVAS_H - 6, Math.min(meterW, CANVAS_W), 4);
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export const AudioTestBench: React.FC = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [writeHead, setWriteHead] = useState(0);
  const [readHead, setReadHead] = useState(0);
  const [overruns, setOverruns] = useState(0);
  const [framesProduced, setFramesProduced] = useState(0);
  const [freq, setFreq] = useState(440);
  const [gain, setGain] = useState(0.5);
  const [tier] = useState<DeviceTier>(2);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sabViewsRef = useRef<SabViews | null>(null);
  const rafRef = useRef<number>(0);
  const workletUrlRef = useRef<string | null>(null);

  /* ── Animation loop ─────────────────────────────────────────────────── */

  const animate = useCallback(() => {
    const views = sabViewsRef.current;
    const canvas = canvasRef.current;
    if (views && canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) drawOscilloscope(ctx, views);

      const wh = Atomics.load(views.heads, 0);
      const rh = Atomics.load(views.heads, 1);
      setWriteHead(wh);
      setReadHead(rh);
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  /* ── Start ──────────────────────────────────────────────────────────── */

  const handleStart = useCallback(async () => {
    if (!crossOriginIsolated) {
      setError('crossOriginIsolated is false — COOP/COEP headers are missing. SharedArrayBuffer unavailable.');
      setStatus('error');
      return;
    }

    setStatus('initializing');
    setError(null);

    try {
      // 1. Spin up the kernel worker
      const worker = new Worker(
        new URL('../dsp/dsp-kernel.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      // 2. Wait for the kernel to post its SAB + pointer payload
      const ready = await new Promise<{
        sab: SharedArrayBuffer;
        writeHeadPtr: number;
        readHeadPtr: number;
        dataPtr: number;
        capacity: number;
      }>((resolve, reject) => {
        worker.onmessage = (e) => {
          if (e.data.type === 'ready') resolve(e.data);
          if (e.data.type === 'error') reject(new Error(e.data.message));
          if (e.data.type === 'tick') {
            setOverruns(e.data.overruns);
            setFramesProduced(e.data.framesProduced);
          }
        };
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage({ type: 'init', sampleRate: 48000, tier });
      });

      // Attach SAB views for main-thread visualization (peek only, no head advance)
      sabViewsRef.current = {
        heads: new Uint32Array(ready.sab, ready.writeHeadPtr, 2),
        data: new Float32Array(ready.sab, ready.dataPtr, ready.capacity),
        capacity: ready.capacity,
        mask: ready.capacity - 1,
      };

      // Wire up the ongoing tick handler now that the promise has resolved
      worker.onmessage = (e) => {
        if (e.data.type === 'tick') {
          setOverruns(e.data.overruns);
          setFramesProduced(e.data.framesProduced);
        }
      };

      // 3. Create AudioContext + load worklet module
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;

      if (!workletUrlRef.current) {
        workletUrlRef.current = makeWorkletBlobUrl();
      }
      await audioCtx.audioWorklet.addModule(workletUrlRef.current);

      // 4. Create AudioWorkletNode and send it the SAB
      const node = new AudioWorkletNode(audioCtx, 'dsp-kernel-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      workletNodeRef.current = node;

      node.port.postMessage({
        sab: ready.sab,
        writeHeadPtr: ready.writeHeadPtr,
        dataPtr: ready.dataPtr,
        capacity: ready.capacity,
      });

      node.connect(audioCtx.destination);

      // 5. Kick off the visualization loop
      rafRef.current = requestAnimationFrame(animate);

      setStatus('running');
    } catch (err) {
      setError(String(err));
      setStatus('error');
      workerRef.current?.terminate();
      workerRef.current = null;
    }
  }, [tier, animate]);

  /* ── Stop ───────────────────────────────────────────────────────────── */

  const handleStop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    workerRef.current?.postMessage({ type: 'dispose' });
    workerRef.current?.terminate();
    workerRef.current = null;

    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    sabViewsRef.current = null;

    setStatus('idle');
    setWriteHead(0);
    setReadHead(0);
    setOverruns(0);
    setFramesProduced(0);

    // Clear canvas
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }, []);

  /* ── Parameter changes ──────────────────────────────────────────────── */

  const handleFreqChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setFreq(v);
    workerRef.current?.postMessage({ type: 'setFreq', freq: v });
  }, []);

  const handleGainChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setGain(v);
    workerRef.current?.postMessage({ type: 'setGain', gain: v });
  }, []);

  /* ── Cleanup on unmount ─────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      workerRef.current?.terminate();
      audioCtxRef.current?.close();
      if (workletUrlRef.current) URL.revokeObjectURL(workletUrlRef.current);
    };
  }, []);

  /* ── Render ─────────────────────────────────────────────────────────── */

  const isRunning = status === 'running';
  const isInit = status === 'initializing';
  const available = writeHead - readHead; // unsigned wrap handled by display only

  return (
    <div style={styles.bench}>
      <div style={styles.header}>
        <span style={styles.title}>DSP Audio Test Bench</span>
        <span style={{ ...styles.badge, background: STATUS_COLORS[status] }}>
          {status.toUpperCase()}
        </span>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Controls */}
      <div style={styles.controls}>
        {!isRunning ? (
          <button
            style={{ ...styles.btn, ...styles.btnStart }}
            onClick={handleStart}
            disabled={isInit}
          >
            {isInit ? 'Initializing…' : 'Start Audio'}
          </button>
        ) : (
          <button style={{ ...styles.btn, ...styles.btnStop }} onClick={handleStop}>
            Stop Audio
          </button>
        )}
      </div>

      {/* Parameter sliders */}
      <div style={styles.sliders}>
        <label style={styles.label}>
          Frequency&nbsp;<span style={styles.val}>{freq} Hz</span>
          <input
            type="range" min={20} max={2000} step={1}
            value={freq} onChange={handleFreqChange}
            disabled={!isRunning}
            style={styles.range}
          />
        </label>
        <label style={styles.label}>
          Gain&nbsp;<span style={styles.val}>{gain.toFixed(2)}</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={gain} onChange={handleGainChange}
            disabled={!isRunning}
            style={styles.range}
          />
        </label>
      </div>

      {/* Oscilloscope */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={styles.canvas}
      />

      {/* Ring buffer stats */}
      <div style={styles.stats}>
        <Stat label="WRITE_HEAD" value={writeHead} mono />
        <Stat label="READ_HEAD"  value={readHead}  mono />
        <Stat label="Available"  value={`${(available >>> 0)} smp`} />
        <Stat label="Overruns"   value={overruns}  alert={overruns > 0} />
        <Stat label="Produced"   value={framesProduced} />
      </div>
    </div>
  );
};

/* ─── Sub-component ──────────────────────────────────────────────────────── */

const Stat: React.FC<{
  label: string;
  value: number | string;
  mono?: boolean;
  alert?: boolean;
}> = ({ label, value, mono, alert }) => (
  <div style={styles.stat}>
    <span style={styles.statLabel}>{label}</span>
    <span style={{ ...styles.statValue, ...(mono ? styles.mono : {}), ...(alert ? styles.alertText : {}) }}>
      {String(value)}
    </span>
  </div>
);

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<Status, string> = {
  idle: '#444',
  initializing: '#886600',
  running: '#006633',
  error: '#880000',
};

const styles: Record<string, React.CSSProperties> = {
  bench: {
    fontFamily: 'monospace',
    background: '#111',
    color: '#ccc',
    border: '1px solid #333',
    borderRadius: 6,
    padding: 16,
    maxWidth: 560,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#eee',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  badge: {
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 3,
    color: '#fff',
    letterSpacing: 1,
  },
  errorBox: {
    background: '#2a0000',
    border: '1px solid #550000',
    borderRadius: 4,
    padding: '8px 10px',
    fontSize: 12,
    color: '#ff8888',
    wordBreak: 'break-word',
  },
  controls: {
    display: 'flex',
    gap: 8,
  },
  btn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 700,
    letterSpacing: 1,
  },
  btnStart: {
    background: '#004d20',
    color: '#00ff88',
  },
  btnStop: {
    background: '#4d0000',
    color: '#ff8888',
  },
  sliders: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#999',
  },
  val: {
    color: '#00ff88',
    minWidth: 60,
    display: 'inline-block',
  },
  range: {
    flex: 1,
    accentColor: '#00ff88',
  },
  canvas: {
    display: 'block',
    border: '1px solid #222',
    borderRadius: 3,
    imageRendering: 'pixelated',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
  },
  stat: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 4,
    padding: '4px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  statLabel: {
    fontSize: 9,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 13,
    color: '#aaa',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  alertText: {
    color: '#ff4444',
  },
};
