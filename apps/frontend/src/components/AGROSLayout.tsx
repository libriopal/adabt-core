/**
 * AGROSLayout — shell layout + persistent DSP control board.
 *
 * Structure:
 *   Top nav bar  (44px)  — AGROS branding, route links, engine status
 *   Content area (flex)  — <Outlet /> for current page
 *   Control surface      — oscilloscope, rotary knobs, emotion pads
 *   Status strip (28px)  — ring-buffer diagnostics
 *
 * The audio engine (Worker + AudioWorklet) lives here so it persists
 * across route changes.  SAB views are read directly on the main thread
 * via Atomics for the oscilloscope and head displays.
 */

import React, {
  useState, useRef, useEffect, useCallback,
  type MouseEvent as RMouseEvent,
  type TouchEvent as RTouchEvent,
} from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { DeviceTier } from '../dsp/wasm/WasmDSPKernel.types';
import { TIER_CAPACITY } from '../dsp/wasm/WasmDSPKernel.types';
import { DSPContext, type SabViews } from '../dsp/DSPContext';
import Oscilloscope from './Oscilloscope';

/* ─── AudioWorklet processor (Blob URL) ─────────────────────────────────── */

const WORKLET_SRC = `
class DspKernelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ready = false;
    this._underruns = 0;
    this._consecutive = 0;
    this.port.onmessage = ({ data: d }) => {
      this._heads = new Uint32Array(d.sab, d.writeHeadPtr, 2);
      this._data  = new Float32Array(d.sab, d.dataPtr, d.capacity);
      this._mask  = d.capacity - 1;
      this._ready = true;
      this._underruns = 0;
      this._consecutive = 0;
    };
  }
  process(_i, outputs) {
    // outputs[0][0] = Left, outputs[0][1] = Right
    const left = outputs[0]?.[0]; if (!left) return true;
    const n = left.length;
    if (!this._ready) { left.fill(0); return true; }
    const wh = Atomics.load(this._heads, 0);
    const rh = Atomics.load(this._heads, 1);
    if ((wh - rh) >>> 0 < n) {
      left.fill(0);
      this._underruns++;
      this._consecutive++;
      if (this._consecutive === 60) {
        console.warn('[DSPWorklet] Buffer consistently empty — ' + this._underruns + ' underruns. Producer may be stalled.');
      }
      return true;
    }
    this._consecutive = 0;
    const { _data: d, _mask: m } = this;
    for (let i = 0; i < n; i++) left[i] = d[(rh + i) & m];
    Atomics.store(this._heads, 1, (rh + n) >>> 0);
    // Copy Left → Right for stereo output
    const right = outputs[0]?.[1];
    if (right) right.set(left);
    return true;
  }
}
registerProcessor('dsp-kernel-processor', DspKernelProcessor);
`;

let _workletUrl: string | null = null;
function workletUrl(): string {
  if (!_workletUrl) {
    _workletUrl = URL.createObjectURL(
      new Blob([WORKLET_SRC], { type: 'application/javascript' }),
    );
  }
  return _workletUrl;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const EMOTIONAL_STATES = [
  'Dread', 'Suspense', 'Escalation', 'Catastrophic Release',
  'Mourning', 'Recovery', 'Silence', 'Ritualistic Build',
] as const;
type EmotionalState = typeof EMOTIONAL_STATES[number];

const EMOTION_COLORS: Record<EmotionalState, string> = {
  'Dread':               '#6b21a8',
  'Suspense':            '#92400e',
  'Escalation':          '#c2410c',
  'Catastrophic Release':'#b91c1c',
  'Mourning':            '#1e3a5f',
  'Recovery':            '#065f46',
  'Silence':             '#1c1c1c',
  'Ritualistic Build':   '#78350f',
};

const TIER_OPTIONS: DeviceTier[] = [0, 1, 2, 3, 4];
const SCOPE_W = 292;
const SCOPE_H = 108;

/* ─── SAB views ─────────────────────────────────────────────────────────── */
// SabViews is imported from DSPContext

/* ─── Sub-components ─────────────────────────────────────────────────────── */

/* Rotary knob — SVG dial with mouse/touch drag (drag-up = increase) */
interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}

const Knob: React.FC<KnobProps> = ({
  label, value, min, max, step = 0.01, decimals = 2, unit = '',
  disabled = false, onChange,
}) => {
  const size = 68;
  const cx = size / 2;
  const cy = size / 2;
  const grooveR = 28;
  const bodyR   = 20;

  const t = (value - min) / (max - min);
  // Clock angles: 0° = 12 o'clock, CW.  Sweep from 225° (SW) to 135°+360°=495° (SE via top).
  const minClock = 225;
  const maxClock = 495;
  const indicatorClock = minClock + t * 270;

  function polarXY(clockDeg: number, r: number) {
    const rad = (clockDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcD(startClock: number, endClock: number, r: number) {
    const s = polarXY(startClock, r);
    const e = polarXY(endClock,   r);
    const sweep = ((endClock - startClock) % 360 + 360) % 360;
    const large = sweep > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  }

  const indEnd = polarXY(indicatorClock, bodyR - 5);

  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);

  const beginDrag = useCallback((clientY: number) => {
    if (disabled) return;
    dragRef.current = { startY: clientY, startVal: value };

    function onMove(clientY: number) {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - clientY;
      const range = max - min;
      const raw = dragRef.current.startVal + (dy / 140) * range;
      const snapped = Math.round(Math.max(min, Math.min(max, raw)) / step) * step;
      onChange(parseFloat(snapped.toFixed(decimals)));
    }

    function onMouseMove(e: globalThis.MouseEvent) { onMove(e.clientY); }
    function onTouchMove(e: globalThis.TouchEvent) { onMove(e.touches[0].clientY); }
    function cleanup() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mouseup',   cleanup);
      document.removeEventListener('touchend',  cleanup);
      dragRef.current = null;
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('mouseup',  cleanup);
    document.addEventListener('touchend', cleanup);
  }, [disabled, value, min, max, step, decimals, onChange]);

  const onMouseDown = useCallback((e: RMouseEvent) => {
    e.preventDefault();
    beginDrag(e.clientY);
  }, [beginDrag]);

  const onTouchStart = useCallback((e: RTouchEvent) => {
    beginDrag(e.touches[0].clientY);
  }, [beginDrag]);

  const valueLabel = value.toFixed(decimals) + (unit ? ` ${unit}` : '');

  return (
    <div style={K.knobWrap}>
      <svg
        width={size} height={size}
        style={{ cursor: disabled ? 'not-allowed' : 'ns-resize', userSelect: 'none' }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* groove background */}
        <path
          d={arcD(minClock, maxClock, grooveR)}
          fill="none"
          stroke="#1a2540"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* value arc */}
        {t > 0.005 && (
          <path
            d={arcD(minClock, minClock + t * 270, grooveR)}
            fill="none"
            stroke={disabled ? '#334' : '#22d3ee'}
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}
        {/* knob body */}
        <circle
          cx={cx} cy={cy} r={bodyR}
          fill="#0d1626"
          stroke="#253350"
          strokeWidth={1.5}
        />
        {/* indicator line */}
        <line
          x1={cx} y1={cy}
          x2={indEnd.x.toFixed(2)} y2={indEnd.y.toFixed(2)}
          stroke={disabled ? '#334' : '#22d3ee'}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* center dot */}
        <circle cx={cx} cy={cy} r={2.5} fill={disabled ? '#334' : '#22d3ee'} />
      </svg>
      <div style={K.knobLabel}>{label}</div>
      <div style={{ ...K.knobValue, color: disabled ? '#334' : '#22d3ee' }}>{valueLabel}</div>
    </div>
  );
};

/* LED status indicator */
const Led: React.FC<{ on: boolean; color?: string }> = ({ on, color = '#22d3ee' }) => (
  <span style={{
    display: 'inline-block',
    width: 8, height: 8,
    borderRadius: '50%',
    background: on ? color : '#1a2540',
    boxShadow: on ? `0 0 6px ${color}` : 'none',
    flexShrink: 0,
  }} />
);

/* Emotional state pad */
const EmotionPad: React.FC<{
  state: EmotionalState;
  active: boolean;
  onClick: () => void;
}> = ({ state, active, onClick }) => {
  const color = EMOTION_COLORS[state];
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color : '#0d1220',
        border: `1px solid ${active ? color : '#1a2540'}`,
        borderRadius: 4,
        color: active ? '#fff' : '#4a5568',
        fontSize: 9,
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
        padding: '4px 6px',
        cursor: 'pointer',
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
        lineHeight: 1.2,
        textAlign: 'center' as const,
        transition: 'all 0.12s',
        boxShadow: active ? `0 0 8px ${color}55` : 'none',
      }}
    >
      {state}
    </button>
  );
};

/* ─── Main layout ────────────────────────────────────────────────────────── */

const AGROSLayout: React.FC = () => {
  /* engine state */
  const [running, setRunning]           = useState(false);
  const [starting, setStarting]         = useState(false);
  const [engineError, setEngineError]   = useState<string | null>(null);
  const [tier, setTier]                 = useState<DeviceTier>(2);

  /* controls */
  const [freq, setFreqState]            = useState(440);
  const [gain, setGainState]            = useState(0.5);
  const [emotion, setEmotion]           = useState<EmotionalState>('Recovery');

  /* diagnostics (main-thread reads) */
  const [writeHead,     setWriteHead]   = useState(0);
  const [readHead,      setReadHead]    = useState(0);
  const [overruns,      setOverruns]    = useState(0);
  const [framesProduced,setFrames]      = useState(0);

  /* refs */
  const workerRef    = useRef<Worker | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const nodeRef      = useRef<AudioWorkletNode | null>(null);
  const sabRef       = useRef<SabViews | null>(null);
  /* Refs for hot-path audio coalescing (avoids React re-renders on every game frame) */
  const freqRef         = useRef(440);
  const gainRef         = useRef(0.5);
  const workerDirtyRef  = useRef({ freq: false, gain: false });

  /* ── Diagnostics polling (WR_HEAD, RD_HEAD, overruns, frames) ──────── */

  useEffect(() => {
    const id = setInterval(() => {
      const views = sabRef.current;
      if (views) {
        setWriteHead(Atomics.load(views.heads, 0));
        setReadHead(Atomics.load(views.heads, 1));
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  /* ── Coalesced worker message flush (~60Hz cadence cap) ────────────── */
  /* Keeps only the latest freq/gain and flushes to worker at most every
     16ms.  Prevents worker-thread saturation from per-frame game engine
     calls while maintaining <12ms Tier 0 jitter budget. */

  useEffect(() => {
    const id = setInterval(() => {
      const dirty = workerDirtyRef.current;
      const worker = workerRef.current;
      if (!worker) return;
      if (dirty.freq) {
        worker.postMessage({ type: 'setFreq', freq: freqRef.current });
        dirty.freq = false;
      }
      if (dirty.gain) {
        worker.postMessage({ type: 'setGain', gain: gainRef.current });
        dirty.gain = false;
      }
    }, 16);
    return () => clearInterval(id);
  }, []);

  /* ── Throttled UI sync (10Hz) — reflect engine-driven values in knobs */
  /* When the game engine drives freq/gain via hot-path setters, the React
     state (and therefore knob display) only updates at this cadence.
     This keeps the status strip and knob labels live without per-frame
     React reconciliation. */

  useEffect(() => {
    const id = setInterval(() => {
      setFreqState(prev => {
        const v = Math.round(freqRef.current);
        return prev !== v ? v : prev;
      });
      setGainState(prev => {
        const v = parseFloat(gainRef.current.toFixed(2));
        return prev !== v ? v : prev;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  /* ── Start engine ──────────────────────────────────────────────────── */

  const handleStart = useCallback(async () => {
    if (!crossOriginIsolated) {
      setEngineError('crossOriginIsolated is false — COOP/COEP headers missing.');
      return;
    }
    setStarting(true);
    setEngineError(null);

    try {
      const worker = new Worker(
        new URL('../dsp/dsp-kernel.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

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
        };
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage({ type: 'init', capacity: TIER_CAPACITY[tier], sampleRate: 48000, tier });
      });

      sabRef.current = {
        heads:    new Uint32Array(ready.sab, ready.writeHeadPtr, 2),
        data:     new Float32Array(ready.sab, ready.dataPtr, ready.capacity),
        capacity: ready.capacity,
        mask:     ready.capacity - 1,
      };

      /* Ongoing worker message handler — receives tick diagnostics
         (worker sends these autonomously every 100ms). */
      worker.onmessage = (e) => {
        if (e.data.type === 'tick') {
          setOverruns(e.data.overruns);
          setFrames(e.data.framesProduced);
        }
      };

      /* Seed initial frequency/gain — post directly for instant startup,
         then the coalescing timer takes over for ongoing updates. */
      worker.postMessage({ type: 'setFreq', freq: freqRef.current });
      worker.postMessage({ type: 'setGain', gain: gainRef.current });

      /* Resume AudioContext first — browser autoplay policy may suspend it */
      const actx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
      audioCtxRef.current = actx;
      await actx.resume();
      await actx.audioWorklet.addModule(workletUrl());

      /* Stereo output: ch0 = Left, ch1 = Right (mono signal duplicated) */
      const node = new AudioWorkletNode(actx, 'dsp-kernel-processor', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      });
      nodeRef.current = node;
      node.port.postMessage({
        sab: ready.sab,
        writeHeadPtr: ready.writeHeadPtr,
        dataPtr: ready.dataPtr,
        capacity: ready.capacity,
      });
      node.connect(actx.destination);

      setRunning(true);
    } catch (err) {
      setEngineError(String(err));
      workerRef.current?.terminate();
      workerRef.current = null;
    } finally {
      setStarting(false);
    }
  }, [tier]);

  /* ── Stop engine ───────────────────────────────────────────────────── */

  const handleStop = useCallback(() => {
    workerRef.current?.postMessage({ type: 'dispose' });
    workerRef.current?.terminate();
    workerRef.current = null;
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    sabRef.current = null;
    workerDirtyRef.current = { freq: false, gain: false };
    setRunning(false);
    setWriteHead(0); setReadHead(0); setOverruns(0); setFrames(0);
  }, []);

  useEffect(() => () => { handleStop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Audio parameter setters ─────────────────────────────────────── */

  /* UI setters: update React state (for knob display) + ref + dirty flag.
     The coalescing timer flushes dirty values to the worker at ≤60Hz. */

  const setFreq = useCallback((v: number) => {
    setFreqState(v);
    freqRef.current = v;
    workerDirtyRef.current.freq = true;
  }, []);

  const setGain = useCallback((v: number) => {
    setGainState(v);
    gainRef.current = v;
    workerDirtyRef.current.gain = true;
  }, []);

  /* Hot-path setters: ref + dirty flag ONLY — no React re-render.
     Use these in game loops / RAF callbacks where per-frame updates
     would otherwise saturate the main thread with React reconciliation. */

  const setFreqHot = useCallback((v: number) => {
    freqRef.current = v;
    workerDirtyRef.current.freq = true;
  }, []);

  const setGainHot = useCallback((v: number) => {
    gainRef.current = v;
    workerDirtyRef.current.gain = true;
  }, []);

  /* ── Render ─────────────────────────────────────────────────────────── */

  const available = (writeHead - readHead) >>> 0;
  const statusColor = engineError ? '#ef4444' : running ? '#22d3ee' : '#4a5568';
  const statusLabel = engineError ? 'ERROR' : starting ? 'STARTING' : running ? 'RUNNING' : 'IDLE';

  const dspValue = { setFreq, setGain, setFreqHot, setGainHot, running, sabViews: sabRef.current };

  return (
    <DSPContext.Provider value={dspValue}>
    <div style={S.root}>

      {/* ── Top nav bar ────────────────────────────────────────────── */}
      <nav style={S.nav}>
        <span style={S.logo}>AGROS</span>

        <div style={S.navLinks}>
          {NAV_ITEMS.map(({ label, path }) => (
            <NavLink
              key={path} to={path} end={path === '/'}
              style={({ isActive }) => ({
                ...S.navLink,
                color:       isActive ? '#22d3ee' : '#4a6080',
                borderBottom: isActive ? '2px solid #22d3ee' : '2px solid transparent',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div style={S.navRight}>
          <Led on={running} color={statusColor} />
          <span style={{ ...S.statusLabel, color: statusColor }}>{statusLabel}</span>

          <select
            value={tier}
            onChange={(e) => setTier(Number(e.target.value) as DeviceTier)}
            disabled={running || starting}
            style={S.tierSelect}
          >
            {TIER_OPTIONS.map(t => (
              <option key={t} value={t}>T{t}</option>
            ))}
          </select>

          <button
            onClick={running ? handleStop : handleStart}
            disabled={starting}
            style={{
              ...S.engineBtn,
              background: running ? '#450a0a' : '#022c22',
              color:       running ? '#ef4444' : '#22d3ee',
              borderColor: running ? '#ef4444' : '#22d3ee',
            }}
          >
            {starting ? 'STARTING…' : running ? 'STOP ENGINE' : 'START ENGINE'}
          </button>
        </div>
      </nav>

      {/* ── Error banner ───────────────────────────────────────────── */}
      {engineError && (
        <div style={S.errorBanner}>{engineError}</div>
      )}

      {/* ── Page content ───────────────────────────────────────────── */}
      <div style={S.content}>
        <Outlet />
      </div>

      {/* ── Control surface ────────────────────────────────────────── */}
      <div style={S.surface}>

        {/* Oscilloscope */}
        <div style={S.scopePanel}>
          <div style={S.panelLabel}>OSCILLOSCOPE</div>
          <Oscilloscope width={SCOPE_W} height={SCOPE_H} />
        </div>

        {/* Divider */}
        <div style={S.divider} />

        {/* Oscillator controls */}
        <div style={S.oscPanel}>
          <div style={S.panelLabel}>OSCILLATOR</div>
          <div style={S.knobRow}>
            <Knob
              label="FREQ"
              value={freq}
              min={20} max={2000} step={1} decimals={0} unit="Hz"
              disabled={!running}
              onChange={setFreq}
            />
            <Knob
              label="GAIN"
              value={gain}
              min={0} max={1} step={0.01} decimals={2}
              disabled={!running}
              onChange={setGain}
            />
          </div>
        </div>

        {/* Divider */}
        <div style={S.divider} />

        {/* Emotional state pads */}
        <div style={S.emotionPanel}>
          <div style={S.panelLabel}>EMOTIONAL STATE</div>
          <div style={S.emotionGrid}>
            {EMOTIONAL_STATES.map(s => (
              <EmotionPad
                key={s}
                state={s}
                active={emotion === s}
                onClick={() => setEmotion(s)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Status strip ───────────────────────────────────────────── */}
      <div style={S.statusStrip}>
        {[
          ['WR_HEAD', `0x${writeHead.toString(16).toUpperCase().padStart(8, '0')}`],
          ['RD_HEAD', `0x${readHead.toString(16).toUpperCase().padStart(8, '0')}`],
          ['AVAIL',   `${available} smp`],
          ['OVERRUNS', overruns, overruns > 0],
          ['FRAMES',  framesProduced],
          ['TIER',    tier],
        ].map(([label, val, alert]) => (
          <div key={String(label)} style={S.statCell}>
            <span style={S.statKey}>{label}</span>
            <span style={{ ...S.statVal, color: alert ? '#ef4444' : '#22d3ee' }}>{String(val)}</span>
          </div>
        ))}
      </div>

    </div>
    </DSPContext.Provider>
  );
};

/* ─── Nav items ──────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { label: 'Rhythm Engine', path: '/' },
  { label: 'ConceptForge',  path: '/concept-forge' },
  { label: 'Music Engine',  path: '/music-engine' },
];

/* ─── Knob sub-styles ─────────────────────────────────────────────────────── */

const K: Record<string, React.CSSProperties> = {
  knobWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  knobLabel: {
    fontSize: 9, color: '#4a6080', letterSpacing: 1,
    fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
  },
  knobValue: {
    fontSize: 11, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.5,
  },
};

/* ─── Layout styles ──────────────────────────────────────────────────────── */

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#080c14',
    color: '#c8d6e8',
    fontFamily: 'JetBrains Mono, system-ui, monospace',
    display: 'flex',
    flexDirection: 'column',
  },

  /* nav */
  nav: {
    height: 44,
    background: '#0d1220',
    borderBottom: '1px solid #1a2540',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 0,
    flexShrink: 0,
  },
  logo: {
    color: '#22d3ee',
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 3,
    marginRight: 20,
    textTransform: 'uppercase',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'stretch',
    flex: 1,
    height: '100%',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
    textDecoration: 'none',
    transition: 'color 0.1s',
    height: '100%',
    fontFamily: 'JetBrains Mono, monospace',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    minWidth: 64,
  },
  tierSelect: {
    background: '#0d1220',
    border: '1px solid #1a2540',
    color: '#4a6080',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    padding: '2px 6px',
    borderRadius: 3,
    cursor: 'pointer',
  },
  engineBtn: {
    padding: '5px 14px',
    border: '1px solid',
    borderRadius: 3,
    fontSize: 10,
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 700,
    letterSpacing: 1.5,
    cursor: 'pointer',
    transition: 'all 0.1s',
  },

  /* error */
  errorBanner: {
    background: '#1a0505',
    borderBottom: '1px solid #7f1d1d',
    color: '#fca5a5',
    fontSize: 11,
    padding: '6px 16px',
    fontFamily: 'JetBrains Mono, monospace',
    flexShrink: 0,
  },

  /* page content */
  content: {
    flex: 1,
    overflow: 'auto',
  },

  /* control surface */
  surface: {
    background: '#0a0f1e',
    borderTop: '1px solid #1a2540',
    display: 'flex',
    alignItems: 'stretch',
    padding: '12px 16px',
    gap: 0,
    flexShrink: 0,
    minHeight: 172,
  },
  panelLabel: {
    fontSize: 8,
    color: '#2a3f5f',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: 700,
  },
  divider: {
    width: 1,
    background: '#1a2540',
    margin: '0 16px',
    alignSelf: 'stretch',
  },

  /* oscilloscope */
  scopePanel: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },

  /* oscillator */
  oscPanel: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  knobRow: {
    display: 'flex',
    gap: 20,
    alignItems: 'center',
    flex: 1,
    paddingTop: 4,
  },

  /* emotion pads */
  emotionPanel: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  emotionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 5,
    flex: 1,
    alignContent: 'start',
  },

  /* status strip */
  statusStrip: {
    background: '#080c14',
    borderTop: '1px solid #0f1628',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    height: 28,
    gap: 0,
    flexShrink: 0,
  },
  statCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 14px 0 0',
    borderRight: '1px solid #0f1628',
    marginRight: 14,
  },
  statKey: {
    fontSize: 8,
    color: '#2a3f5f',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 10,
    fontFamily: 'JetBrains Mono, monospace',
    color: '#22d3ee',
  },
};

export default AGROSLayout;
