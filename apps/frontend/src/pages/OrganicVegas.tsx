// ─────────────────────────────────────────────────────
// Organic Vegas — Grid-Chain Farkle Game Page
//
// Game loop: draw connected chains on the die grid → scoreFarkle(chain faces)
//   → submit via SUBMIT_CHAIN to authoritative backend → CHAIN_RESULT feedback.
//
// Solo mode: local CSPRNG grid + local scoring (no backend required).
// Multi mode: backend grid + WebSocket SUBMIT_CHAIN protocol.
//
// 3D OrganicVegasScene renders as atmospheric background only.
// CSPRNG → Sacred Core scorer → 20-genre Dream Core wrappers (all rtpGated=true in beta).
// LITE/ELITE quality auto-selected from hardwareTier.
// ─────────────────────────────────────────────────────

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

import type { Cell, DieFace, GridPos } from '@match3d/farkle-shared';
import { GAME_CONSTANTS, FACE_TO_COLOR, MULTIPLIER_LADDER } from '@match3d/farkle-shared';
import { seededRng, scoreFarkle } from '@match3d/farkle-engine';
import { VoxelPhysicsSystem } from '@match3d/game-core';
import type { VoxelTransform } from '@match3d/game-core';

import { useDreamStore } from '../../../../packages/dream-core/src/state/dreamStore';
import { dreamAudio } from '../../../../packages/dream-core/src/audio/DreamAudioEngine';
import { resolveModifiers } from '../../../../packages/dream-core/src/conflictResolution';

import { OrganicVegasScene } from '../components/game/OrganicVegasScene';
import type { OrganicVegasSceneHandle, CollisionImpulseEvent } from '../components/game/OrganicVegasScene';
import { ChainBoard } from '../components/game/ChainBoard';
import type { ChainCommitPayload } from '../components/game/ChainBoard';

import { useOrganicMultiplayer } from '../hooks/useOrganicMultiplayer';
import { HARDWARE } from '../utils/hardwareTier';
import '../styles/organic-vegas.css';

// ── Life-Force (FAR_NZY energy adapted as wrapper — does NOT touch Sacred Core) ──

const MAX_LIFE_FORCE = 300;
const LIFE_FORCE_PER_BANK = 20;
const LIFE_FORCE_PER_FARKLE = -30;

function useLifeForce() {
  const [lifeForce, setLifeForce] = useState(150);
  const spend = useCallback((amt: number) => {
    setLifeForce(prev => Math.max(0, Math.min(MAX_LIFE_FORCE, prev - amt)));
  }, []);
  const gain = useCallback((amt: number) => {
    setLifeForce(prev => Math.min(MAX_LIFE_FORCE, prev + amt));
  }, []);
  return { lifeForce, spend, gain };
}

// ── Local grid factory (solo mode — no backend required) ─────────────────────
// Uses seededRng (deterministic xorshift). NOT a Sacred Core function.

function createLocalGrid(seed: number, dim: number): Cell[][] {
  const rng = seededRng(seed);
  const faces: DieFace[] = [1, 2, 3, 4, 5, 6];
  return Array.from({ length: dim }, (_r, r) =>
    Array.from({ length: dim }, (_c, c) => {
      const face = faces[Math.floor(rng() * 6)] as DieFace;
      return {
        id: `${r}-${c}`,
        face,
        type: FACE_TO_COLOR[face],
        state: 'NORMAL' as const,
      };
    }),
  );
}

// After a chain is committed, replace only those cells with fresh faces
function replaceChainCells(grid: Cell[][], chain: GridPos[], rng: () => number): Cell[][] {
  const faces: DieFace[] = [1, 2, 3, 4, 5, 6];
  const next = grid.map(row => row.slice());
  for (const { row, col } of chain) {
    const face = faces[Math.floor(rng() * 6)] as DieFace;
    next[row]![col] = { id: `${row}-${col}-${Date.now()}`, face, type: FACE_TO_COLOR[face], state: 'NORMAL' };
  }
  return next;
}

// ── Multiplier ladder ─────────────────────────────────────────────────────────

function getMultiplier(step: number): number {
  return MULTIPLIER_LADDER[Math.min(step, MULTIPLIER_LADDER.length - 1)] ?? 1;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrganicVegas() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameMode = searchParams.get('mode') ?? 'solo';
  const isSolo = gameMode === 'solo';

  // 3D scene refs (atmospheric background only)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrganicVegasSceneHandle>(null);
  const physicsRef = useRef<VoxelPhysicsSystem | null>(null);
  const transformsRef = useRef<VoxelTransform[]>([]);

  // CSPRNG for local grid operations
  const rngRef = useRef<(() => number) | null>(null);

  // Dream Core store
  const processRoll = useDreamStore(s => s.processRoll);
  const bankSuccess = useDreamStore(s => s.bankSuccess);
  const bankFarkle = useDreamStore(s => s.bankFarkle);
  const wrapScore = useDreamStore(s => s.wrapScore);
  const heartbeat = useDreamStore(s => s.heartbeat);
  const trickMeter = useDreamStore(s => s.trickMeter);
  const dreamState = useDreamStore(s => s);

  const { lifeForce, spend: spendLifeForce, gain: gainLifeForce } = useLifeForce();

  // ── Local game state ─────────────────────────────────────────────────────
  const [localGrid, setLocalGrid] = useState<Cell[][] | null>(null);
  const [unbanked, setUnbanked] = useState(0);
  const [banked, setBanked] = useState(0);
  const [multiplierStep, setMultiplierStep] = useState(0);
  const [lastFarkle, setLastFarkle] = useState(false);
  const [lastCombo, setLastCombo] = useState('');
  const [physicsReady, setPhysicsReady] = useState(false);
  const [chainCount, setChainCount] = useState(0);

  // Multiplayer hook (also used for solo if backend is reachable — falls back gracefully)
  const { state: mpState, isMyTurn, sendChain, sendBank } = useOrganicMultiplayer({
    playerName: 'WRAITH',
  });

  const isMulti = !isSolo;
  const canAct = isSolo ? true : isMyTurn;

  // Active grid: backend grid for multi, local grid for solo
  const activeGrid: Cell[][] | null = isSolo ? localGrid : mpState.grid;

  // ── Initialize ───────────────────────────────────────────────────────────
  useEffect(() => {
    // CSPRNG seed from crypto entropy — deterministic xorshift, never Math.random
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0xdeadbeef;
    rngRef.current = seededRng(seed);

    // Create local grid for solo (or as fallback when backend grid not yet received)
    setLocalGrid(createLocalGrid(seed, GAME_CONSTANTS.gridRows));

    dreamAudio.init();

    // Boot physics for atmospheric background (not game-state authority)
    let mounted = true;
    VoxelPhysicsSystem.create(seed).then(sys => {
      if (!mounted) { sys.destroy(); return; }
      physicsRef.current = sys;
      sys['onStep'] = (transforms: VoxelTransform[]) => {
        transformsRef.current = transforms;
        sceneRef.current?.updateTransforms(transforms);
      };
      setPhysicsReady(true);
    }).catch(() => setPhysicsReady(true));

    return () => {
      mounted = false;
      physicsRef.current?.destroy();
      physicsRef.current = null;
      dreamAudio.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Collision impulse → DreamAudioEngine ─────────────────────────────────
  const onImpulse = useCallback((ev: CollisionImpulseEvent) => {
    if (ev.impulse > 0.5) {
      dreamAudio.resume();
      dreamAudio.applyTrickMeter({
        percussionLayer: 0.8 + ev.impulse * 0.2,
        bassLayer: 0.7,
        leadLayer: 0.6,
        filterCutoff: 4000 + ev.impulse * 6000,
        reverbMix: 0.2,
      });
    }
  }, []);

  // ── Chain commit handler ─────────────────────────────────────────────────
  const handleChainCommit = useCallback((payload: ChainCommitPayload) => {
    if (!canAct) return;
    dreamAudio.resume();
    processRoll(Date.now());
    setChainCount(n => n + 1);
    setLastFarkle(false);

    if (isMulti) {
      // Authoritative: send to backend, wait for CHAIN_RESULT
      sendChain(payload.chain);
      return;
    }

    // Solo: score locally via Sacred Core scoreFarkle (already computed in ChainBoard preview)
    const result = scoreFarkle(payload.faces, 1);

    if (result.isFarkle) {
      setLastFarkle(true);
      setUnbanked(0);
      setMultiplierStep(0);
      setLastCombo('FARKLE');
      gainLifeForce(LIFE_FORCE_PER_FARKLE);
      bankFarkle();
      dreamAudio.playFarkle();
      // Replace chain cells with fresh dice
      setLocalGrid(prev => prev ? replaceChainCells(prev, payload.chain, rngRef.current!) : prev);
      return;
    }

    // Conflict Resolution Layer (all modifiers rtpGated=true in beta → multiplier stays 1.0)
    const resolved = resolveModifiers(dreamState);
    const baseScore = result.score;
    const multiplier = getMultiplier(multiplierStep) * resolved.payoutMultiplier;
    const effectiveScore = Math.round(baseScore * multiplier);
    const newStep = payload.chain.length === GAME_CONSTANTS.maxChainLength
      ? Math.min(multiplierStep + 1, MULTIPLIER_LADDER.length - 1)
      : 0;

    // Auto-bank if chain < 6 (mirrors backend processChain behavior)
    if (payload.chain.length < GAME_CONSTANTS.maxChainLength) {
      const newBanked = banked + unbanked + effectiveScore;
      setBanked(newBanked);
      setUnbanked(0);
      setMultiplierStep(0);
      setLastCombo(`${result.combo} · BANKED`);
      gainLifeForce(LIFE_FORCE_PER_BANK);
      bankSuccess();
      dreamAudio.playBank(effectiveScore);
    } else {
      setUnbanked(prev => prev + effectiveScore);
      setMultiplierStep(newStep);
      setLastCombo(`${result.combo} ×${getMultiplier(newStep).toFixed(2)}`);
      dreamAudio.playBank(effectiveScore);
    }

    // Replace chain cells
    setLocalGrid(prev => prev ? replaceChainCells(prev, payload.chain, rngRef.current!) : prev);
  }, [
    canAct, isMulti, sendChain, processRoll, bankFarkle, bankSuccess,
    gainLifeForce, dreamState, multiplierStep, unbanked, banked,
  ]);

  // ── Bank unbanked score (6-chain accumulation) ───────────────────────────
  const handleBank = useCallback(() => {
    if (!canAct || unbanked <= 0) return;
    if (isMulti) { sendBank(); return; }
    const wrapped = wrapScore(unbanked, [], banked, trickMeter.level === 'FRENZY');
    setBanked(prev => prev + wrapped);
    setUnbanked(0);
    setMultiplierStep(0);
    setLastCombo('');
    gainLifeForce(LIFE_FORCE_PER_BANK);
    bankSuccess();
    dreamAudio.playBank(wrapped);
  }, [canAct, unbanked, isMulti, sendBank, wrapScore, banked, trickMeter.level, gainLifeForce, bankSuccess]);

  // ── Mirror multiplayer CHAIN_RESULT into local display ──────────────────
  useEffect(() => {
    if (!isMulti || !mpState.lastChainResult) return;
    const r = mpState.lastChainResult;
    if (r.result === 'FARKLE') {
      setLastFarkle(true);
      setUnbanked(0);
      setLastCombo('FARKLE');
    } else {
      setLastFarkle(false);
      setUnbanked(r.unbanked);
      setBanked(r.banked);
      setLastCombo('');
    }
  }, [isMulti, mpState.lastChainResult]);

  // ── Life-force bar ───────────────────────────────────────────────────────
  const lfPct = (lifeForce / MAX_LIFE_FORCE) * 100;
  const lfColor = lfPct > 60 ? 'var(--ov-ichor-green)' : lfPct > 30 ? 'var(--ov-gold)' : 'var(--ov-blood-red)';

  // ── Multiplier display ───────────────────────────────────────────────────
  const currentMultiplier = useMemo(() => getMultiplier(multiplierStep), [multiplierStep]);

  // ── Container resize → Three.js canvas ──────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const obs = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry || !canvasRef.current) return;
      const { width, height } = entry.contentRect;
      const dpr = HARDWARE.quality === 'ELITE' ? Math.min(window.devicePixelRatio, 2) : 1;
      canvasRef.current.width = Math.round(width * dpr);
      canvasRef.current.height = Math.round(height * dpr);
      canvasRef.current.style.width = `${width}px`;
      canvasRef.current.style.height = `${height}px`;
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const displayUnbanked = isMulti ? mpState.lastChainResult?.unbanked ?? 0 : unbanked;
  const displayBanked = isMulti
    ? mpState.players.find(p => p.id === mpState.localPlayerId)?.banked ?? 0
    : banked;

  return (
    <div className="ov-game" ref={containerRef} style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#050008' }}>

      {/* ── 3D atmospheric background ── */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35, pointerEvents: 'none' }}
      />
      {physicsReady && canvasRef.current && (
        <OrganicVegasScene
          ref={sceneRef}
          canvasRef={canvasRef}
          heartbeatIntensity={lifeForce / 150}
          onImpulse={onImpulse}
        />
      )}

      {/* ── Main game layout ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        height: '100%', padding: HARDWARE.isMobile ? '8px 4px' : '12px 16px',
        gap: 8,
        overflowY: 'auto',
      }}>

        {/* ── HUD strip ── */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          justifyContent: 'space-between', width: '100%', maxWidth: 600,
          padding: '6px 12px',
          background: 'rgba(5,0,8,0.86)',
          border: '1px solid rgba(201,168,76,0.28)',
          borderRadius: 6,
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <HudBadge label="BANKED" value={displayBanked.toLocaleString()} color="var(--ov-gold)" />
            <HudBadge label="UNBANKED" value={displayUnbanked.toLocaleString()} color="#3388ff" />
            {multiplierStep > 0 && (
              <HudBadge label="MULT" value={`×${currentMultiplier.toFixed(2)}`} color="#c8d400" />
            )}
            <HudBadge label="CHAINS" value={chainCount.toString()} color="#c9a84c88" />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Life-Force bar */}
            <div title="Life Force" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: 9, color: 'var(--ov-bone-shadow)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>VITALITY</div>
              <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${lfPct}%`, height: '100%', background: lfColor, transition: 'width 220ms, background 220ms', borderRadius: 3 }} />
              </div>
            </div>

            <button className="ov-btn" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => navigate('/organic-vegas')}>
              ← EXIT
            </button>
          </div>
        </div>

        {/* ── Multiplayer status ── */}
        {isMulti && (
          <div style={{ fontSize: 11, color: isMyTurn ? '#c8d400' : '#3388ff', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
            {isMyTurn ? '▶ YOUR TURN' : `⟳ ${mpState.players.find(p => p.id === mpState.activePlayerId)?.name ?? 'OPPONENT'}'S TURN`}
            {mpState.players.map(p => (
              <span key={p.id} style={{ marginLeft: 12, color: '#c9a84c' }}>
                {p.name}: {p.banked.toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {/* ── Last combo / result ── */}
        {lastCombo && (
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: lastFarkle ? '#ff2b55' : '#c8d400',
            fontFamily: 'monospace', letterSpacing: '0.15em',
            textShadow: `0 0 8px ${lastFarkle ? '#ff2b55' : '#c8d400'}`,
          }}>
            {lastCombo}
          </div>
        )}

        {/* ── Chain Board ── */}
        {activeGrid ? (
          <ChainBoard
            grid={activeGrid}
            canAct={canAct}
            lastFarkle={lastFarkle}
            onChainCommit={handleChainCommit}
            className="ov-chain-board"
          />
        ) : (
          <div style={{ color: '#c9a84c', fontFamily: 'monospace', fontSize: 13, marginTop: 40 }}>
            {isMulti ? 'AWAITING BOARD FROM SERVER…' : 'INITIALIZING GRID…'}
          </div>
        )}

        {/* ── Bank button (for 6-chain accumulated unbanked) ── */}
        {unbanked > 0 && !isMulti && (
          <button
            className="ov-btn"
            onClick={handleBank}
            disabled={!canAct}
            style={{ padding: '10px 28px', fontSize: 14 }}
          >
            BANK {unbanked.toLocaleString()} PTS
          </button>
        )}

        {/* ── Mode / tier label ── */}
        <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.35)', letterSpacing: '0.12em', fontFamily: 'monospace', marginTop: 'auto' }}>
          {isSolo ? 'SOLO · ' : 'VS · '}{HARDWARE.quality} · TIER {HARDWARE.dspTier} · {GAME_CONSTANTS.gridRows}×{GAME_CONSTANTS.gridCols} GRID
        </div>

      </div>
    </div>
  );
}

// ── Small HUD badge component ─────────────────────────────────────────────────

interface HudBadgeProps { label: string; value: string; color: string; }

function HudBadge({ label, value, color }: HudBadgeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 9, color: 'rgba(201,168,76,0.55)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 900, color, fontFamily: 'monospace', lineHeight: 1 }}>{value}</span>
    </div>
  );
}
