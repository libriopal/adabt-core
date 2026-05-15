// ─────────────────────────────────────────────────────
// Organic Vegas — 3D Bio-Architectural Farkle Game Page
// Three.js canvas with Rapier3D physics (VoxelPhysicsSystem).
// CSPRNG → Sacred Core scorer → 20-genre Dream Core wrappers.
// LITE/ELITE quality auto-selected from hardwareTier.
// Collision impulse events feed DreamAudioEngine ERK states.
// ─────────────────────────────────────────────────────

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { VoxelPhysicsSystem } from '@match3d/game-core';
import type { VoxelTransform } from '@match3d/game-core';
import { seededRng, scoreFarkle } from '@match3d/farkle-engine';
import type { DieFace } from '@match3d/farkle-shared';

import { useDreamStore } from '../../../../packages/dream-core/src/state/dreamStore';
import { dreamAudio } from '../../../../packages/dream-core/src/audio/DreamAudioEngine';
import { resolveModifiers } from '../../../../packages/dream-core/src/conflictResolution';

import { OrganicVegasScene } from '../components/game/OrganicVegasScene';
import type { OrganicVegasSceneHandle, CollisionImpulseEvent } from '../components/game/OrganicVegasScene';

import { useOrganicMultiplayer } from '../hooks/useOrganicMultiplayer';
import { HARDWARE } from '../utils/hardwareTier';
import '../styles/organic-vegas.css';

// ── Life-Force (FAR_NZY energy adapted for Dream Core turn-based) ─────────────
// Energy accrues each turn from roll events. Spending energy enables
// special actions. This is a wrapper; it does NOT modify Sacred Core scorer.
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

// ── Main component ────────────────────────────────────────────────────────────

export default function OrganicVegas() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameMode = searchParams.get('mode') ?? 'solo';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrganicVegasSceneHandle>(null);
  const physicsRef = useRef<VoxelPhysicsSystem | null>(null);
  const transformsRef = useRef<VoxelTransform[]>([]);
  const rngRef = useRef<(() => number) | null>(null);

  // Dream store
  const initMatch = useDreamStore(s => s.initMatch);
  const processRoll = useDreamStore(s => s.processRoll);
  const bankSuccess = useDreamStore(s => s.bankSuccess);
  const bankFarkle = useDreamStore(s => s.bankFarkle);
  const nextTurn = useDreamStore(s => s.nextTurn);
  const wrapScore = useDreamStore(s => s.wrapScore);
  const heartbeat = useDreamStore(s => s.heartbeat);
  const trickMeter = useDreamStore(s => s.trickMeter);
  const dreamState = useDreamStore(s => s);

  const { lifeForce, spend: spendLifeForce, gain: gainLifeForce } = useLifeForce();

  // Game state
  const [faces, setFaces] = useState<DieFace[]>([]);
  const [unbanked, setUnbanked] = useState(0);
  const [banked, setBanked] = useState(0);
  const [isFarkle, setIsFarkle] = useState(false);
  const [physicsReady, setPhysicsReady] = useState(false);
  const [lastCombo, setLastCombo] = useState('');
  const [rollCount, setRollCount] = useState(0);

  // Multiplayer
  const { state: mpState, isMyTurn } = useOrganicMultiplayer({
    playerName: 'PLAYER',
    wsUrl: `ws://${window.location.hostname}:3001`,
  });
  const isMulti = gameMode === 'multi';
  const canAct = !isMulti || isMyTurn;

  // ── Initialize session ────────────────────────────────────────────────────
  useEffect(() => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0xdeadbeef;
    rngRef.current = seededRng(seed);
    initMatch(120);
    dreamAudio.init();

    let mounted = true;
    VoxelPhysicsSystem.create(seed).then(sys => {
      if (!mounted) { sys.destroy(); return; }
      physicsRef.current = sys;

      // Listen for physics steps → push transforms to Three.js scene
      sys['onStep'] = (transforms: VoxelTransform[]) => {
        transformsRef.current = transforms;
        sceneRef.current?.updateTransforms(transforms);
      };

      setPhysicsReady(true);
    }).catch(err => {
      console.error('[OrganicVegas] Rapier3D init failed:', err);
      // Fallback: physics-less mode still allows dice roll + score
      setPhysicsReady(true);
    });

    return () => {
      mounted = false;
      physicsRef.current?.destroy();
      physicsRef.current = null;
      dreamAudio.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Collision impulse → DreamAudioEngine ─────────────────────────────────
  const onImpulse = useCallback((ev: CollisionImpulseEvent) => {
    // Map collision impulse to ERK emotional state modulation
    if (ev.impulse > 0.7 && heartbeat.active) {
      // Heartbeat already managed by useDreamCore subscription;
      // just ensure audio is resumed on high-impulse collision
      dreamAudio.resume();
    }
    // High-impulse collisions bump trick meter filter cutoff
    if (ev.impulse > 0.5) {
      dreamAudio.applyTrickMeter({
        percussionLayer: 0.8 + ev.impulse * 0.2,
        bassLayer: 0.7,
        leadLayer: 0.6,
        filterCutoff: 4000 + ev.impulse * 6000,
        reverbMix: 0.2,
      });
    }
  }, [heartbeat.active]);

  // ── Roll ─────────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (!canAct || !physicsReady) return;
    const rng = rngRef.current!;
    dreamAudio.resume();
    processRoll(Date.now()); // advances rhythm/beat state

    // CSPRNG dice — deterministic xorshift, no Math.random
    const newFaces: DieFace[] = Array.from({ length: 6 }, () =>
      (Math.floor(rng() * 6) + 1) as DieFace,
    );

    const result = scoreFarkle(newFaces, 1);
    setFaces(newFaces);
    setRollCount(r => r + 1);

    if (result.isFarkle) {
      setIsFarkle(true);
      setUnbanked(0);
      setLastCombo('FARKLE');
      gainLifeForce(LIFE_FORCE_PER_FARKLE);  // life-force drain on farkle
      bankFarkle();
      dreamAudio.playFarkle();
    } else {
      // Conflict Resolution Layer — apply non-RTP-gated modifiers
      const resolved = resolveModifiers(dreamState);
      // payoutMultiplier is 1.0 until MC-validated; apply only experience effects
      const baseScore = result.score;
      // scoreMultiplier only applied when payoutMultiplier != 1 AND MC-validated
      // (currently all rtpGated, so effective multiplier stays 1.0 in beta)
      const effectiveScore = Math.round(baseScore * resolved.payoutMultiplier);

      setIsFarkle(false);
      setUnbanked(prev => prev + effectiveScore);
      setLastCombo(`${result.combo} (+${effectiveScore})`);
      dreamAudio.playBank(effectiveScore);
    }
  }, [canAct, physicsReady, processRoll, bankFarkle, gainLifeForce, dreamState]);

  // ── Bank ─────────────────────────────────────────────────────────────────
  const handleBank = useCallback(() => {
    if (!canAct || unbanked <= 0 || isFarkle) return;
    const wrapped = wrapScore(unbanked, faces.map(Number), banked, trickMeter.level === 'FRENZY');
    setBanked(prev => prev + wrapped);
    setUnbanked(0);
    setFaces([]);
    setIsFarkle(false);
    setLastCombo('');
    gainLifeForce(LIFE_FORCE_PER_BANK);
    bankSuccess();
    nextTurn();
    dreamAudio.playBank(wrapped);
  }, [canAct, unbanked, isFarkle, wrapScore, faces, banked, trickMeter.level, gainLifeForce, bankSuccess, nextTurn]);

  // ── Life-force meter bar style ────────────────────────────────────────────
  const lfPct = (lifeForce / MAX_LIFE_FORCE) * 100;
  const lfColor = lfPct > 60 ? 'var(--ov-ichor-green)' : lfPct > 30 ? 'var(--ov-gold)' : 'var(--ov-blood-red)';

  // ── Canvas resize observer ────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const obs = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry || !canvasRef.current) return;
      const { width, height } = entry.contentRect;
      canvasRef.current.width = Math.round(width * (HARDWARE.quality === 'ELITE' ? Math.min(window.devicePixelRatio, 2) : 1));
      canvasRef.current.height = Math.round(height * (HARDWARE.quality === 'ELITE' ? Math.min(window.devicePixelRatio, 2) : 1));
      canvasRef.current.style.width = `${width}px`;
      canvasRef.current.style.height = `${height}px`;
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Opponent panel (multiplayer) ──────────────────────────────────────────
  const opponents = useMemo(() =>
    mpState.players.filter(p => p.id !== mpState.localPlayerId),
    [mpState.players, mpState.localPlayerId],
  );

  return (
    <div className={`ov-root${HARDWARE.isMobile ? ' ov-root--mobile' : ''}`}>
      {/* ── Header ── */}
      <header className="ov-header">
        <div className="ov-title" style={{ fontSize: 16 }}>ORGANIC VEGAS</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Life-Force bar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <div className="ov-label">LIFE-FORCE</div>
            <div style={{ width: 120, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <div style={{
                width: `${lfPct}%`,
                height: '100%',
                background: lfColor,
                borderRadius: 3,
                transition: 'width 0.3s ease',
                boxShadow: `0 0 6px ${lfColor}`,
              }} />
            </div>
          </div>

          {/* Turn indicator */}
          {isMulti && (
            <div className="ov-label" style={{ color: isMyTurn ? 'var(--ov-ichor-green)' : 'var(--ov-bone-shadow)' }}>
              {isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
            </div>
          )}

          <div className={`ov-tier-badge${HARDWARE.quality === 'ELITE' ? ' ov-tier-badge--elite' : ''}`}>
            {HARDWARE.quality}
          </div>

          <button
            className="ov-btn ov-btn--danger"
            onClick={() => navigate('/organic-vegas')}
            style={{ padding: '6px 14px', fontSize: '9px' }}
          >
            EXIT
          </button>
        </div>
      </header>

      {/* ── 3D Scene ── */}
      <div className="ov-scene-wrap" ref={containerRef}>
        <canvas ref={canvasRef} className="ov-scene-canvas" />

        {/* OrganicVegasScene mounts into the canvas imperatively */}
        <OrganicVegasScene
          ref={sceneRef}
          onImpulse={onImpulse}
          heartbeatIntensity={heartbeat.vignetteIntensity}
          canvasRef={canvasRef}
        />

        {/* Heartbeat vignette overlay */}
        <div
          className="ov-vignette"
          style={{ opacity: heartbeat.vignetteIntensity }}
        />

        {/* HUD overlay — right panel */}
        <div className="ov-hud-overlay">
          <div className="ov-hud-panel">
            <div className="ov-label">BANKED</div>
            <div className="ov-value">{banked.toLocaleString()}</div>
            <hr className="ov-divider" />
            <div className="ov-label">UNBANKED</div>
            <div className="ov-value--cyan" style={{ fontSize: 16 }}>{unbanked.toLocaleString()}</div>
            <hr className="ov-divider" />
            <div className="ov-label">ROLL #{rollCount}</div>
            <div style={{ fontSize: 10, color: 'var(--ov-bone-shadow)', marginTop: 2 }}>
              {lastCombo || '—'}
            </div>
            {isFarkle && (
              <div style={{
                marginTop: 8,
                color: 'var(--ov-blood-red)',
                fontSize: 16,
                fontWeight: 900,
                textShadow: '0 0 12px var(--ov-blood-red)',
                letterSpacing: '0.2em',
              }}>
                FARKLE
              </div>
            )}
          </div>

          {/* Left panel: dice faces */}
          <div className="ov-hud-panel ov-hud-panel--left">
            <div className="ov-label">DICE</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {(faces.length > 0 ? faces : [1, 2, 3, 4, 5, 6]).map((f, i) => (
                <div key={i} style={{
                  width: 28, height: 28,
                  border: '1px solid var(--ov-border)',
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                  color: f === 1 || f === 5 ? 'var(--ov-gold-glow)' : 'var(--ov-bone-light)',
                  background: 'rgba(5,3,10,0.7)',
                  boxShadow: (f === 1 || f === 5) ? '0 0 6px var(--ov-gold)' : 'none',
                }}>
                  {f}
                </div>
              ))}
            </div>

            {/* Trick meter */}
            <hr className="ov-divider" />
            <div className="ov-label">TRICK METER</div>
            <div style={{ fontSize: 12, color: 'var(--ov-neural-cyan)', fontWeight: 700 }}>
              {trickMeter.level}
            </div>

            {/* Multiplayer opponents */}
            {opponents.length > 0 && (
              <>
                <hr className="ov-divider" />
                <div className="ov-label">OPPONENT</div>
                {opponents.map(op => (
                  <div key={op.id} style={{ fontSize: 11, color: 'var(--ov-bone-shadow)' }}>
                    {op.name}: {op.banked.toLocaleString()}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer actions ── */}
      <footer className="ov-footer">
        <button
          className="ov-btn ov-btn--cyan"
          onClick={handleRoll}
          disabled={!physicsReady || !canAct}
        >
          {!physicsReady ? 'LOADING PHYSICS…' : 'ROLL DICE'}
        </button>
        <button
          className="ov-btn"
          onClick={handleBank}
          disabled={unbanked <= 0 || isFarkle || !canAct}
        >
          BANK {unbanked > 0 ? `+${unbanked.toLocaleString()}` : ''}
        </button>
        <button
          className="ov-btn ov-btn--danger"
          onClick={() => {
            // Combo Breaker: spend 30 life-force to attempt a farkle reversal
            if (isFarkle && lifeForce >= 30) {
              spendLifeForce(30);
              setIsFarkle(false);
              setUnbanked(50); // emergency salvage score
              setLastCombo('COMBO BREAK (+50)');
            }
          }}
          disabled={!isFarkle || lifeForce < 30}
          style={{ fontSize: '9px' }}
        >
          COMBO BREAK (−30 LF)
        </button>
      </footer>
    </div>
  );
}
