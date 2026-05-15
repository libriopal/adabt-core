// ─────────────────────────────────────────────────────
// DREAM-CORE — Main Game Application
// Orchestrates all game components into a single view.
// Dark Gothic Hacker aesthetic — the game IS music.
//
// CSPRNG wiring: dice rolls now use authoritative seeded RNG
// from packages/farkle-engine/src/csprng.ts.
// Sacred Core scorer (scoreFarkle) evaluates every roll result.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback, useRef } from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import { useDreamCore } from '../../hooks/useDreamCore';
import { seededRng, scoreFarkle } from '@match3d/farkle-engine';
import type { DieFace } from '@match3d/farkle-shared';

import { NeonOscilloscope } from './NeonOscilloscope';
import { BeatHighway } from './BeatHighway';
import { DreamHUD } from './DreamHUD';
import { DreamGameBoard } from './DreamGameBoard';
import { DiceDisplay } from './DiceDisplay';
import { TrickMeterBar } from './TrickMeterBar';
import { VignetteOverlay } from './VignetteOverlay';
import { ClassSelector } from './ClassSelector';
import { FacetDraftPanel } from './FacetDraftPanel';

import '../../styles/dream-gothic.css';

interface DreamAppProps {
  playerId?: string;
  bpm?: number;
}

export const DreamApp: React.FC<DreamAppProps> = ({
  playerId = 'player1',
  bpm = 120,
}) => {
  const { handleRoll, handleBank, handleFarkle, handleComboBreaker, audio } = useDreamCore(bpm);

  const selectedClass = useDreamStore(s => s.diceClass.selectedClass);
  const heroJourney = useDreamStore(s => s.heroJourney);
  const heartbeat = useDreamStore(s => s.heartbeat);

  // ── seededRng session (crypto entropy seed, never Math.random) ──────────
  // seededRng is synchronous xorshift — deterministic, reproducible.
  const rngRef = useRef<(() => number) | null>(null);
  if (!rngRef.current) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0xdeadbeef;
    rngRef.current = seededRng(seed);
  }

  // ── Live game state (wired to Sacred Core) ──────────────────────────────
  const [currentFaces, setCurrentFaces] = useState<DieFace[]>([]);
  const [scoringMask, setScoringMask] = useState<boolean[]>([]);
  const [unbanked, setUnbanked] = useState(0);
  const [banked, setBanked] = useState(0);
  const [isFarkle, setIsFarkle] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [gamePhase, setGamePhase] = useState<'CLASS_SELECT' | 'PLAYING' | 'DRAFT'>('CLASS_SELECT');

  const handleClassSelected = useCallback(() => {
    setGamePhase('PLAYING');
  }, []);

  const handleFacetDrafted = useCallback(() => {
    setShowDraft(false);
    setGamePhase('PLAYING');
  }, []);

  // ── Roll: authoritative CSPRNG → Sacred Core scorer ─────────────────────
  const onRoll = useCallback(() => {
    const rng = rngRef.current!;
    audio.resume();
    const accuracy = handleRoll(); // advances dream-core rhythm state

    // Roll 6 dice via seededRng (deterministic xorshift, no Math.random)
    const faces: DieFace[] = Array.from({ length: 6 }, () =>
      (Math.floor(rng() * 6) + 1) as DieFace,
    );

    // Sacred Core scorer — never call Math.random() here
    const result = scoreFarkle(faces, 1);

    setCurrentFaces(faces);

    if (result.isFarkle) {
      // All dice non-scoring
      setScoringMask(new Array(6).fill(false));
      setIsFarkle(true);
      setUnbanked(0);
      handleFarkle();
    } else {
      // Build scoring mask: face is scoring if it contributes to combo
      // Approximate: 1s and 5s always score; full combos mark all
      const mask = faces.map(f =>
        f === 1 || f === 5 || result.combo.includes('Straight') || result.combo.includes('Triplet'),
      );
      setScoringMask(mask);
      setIsFarkle(false);
      setUnbanked(prev => prev + result.score);
    }

    void accuracy; // rhythm accuracy used by dream-core internally
  }, [audio, handleRoll, handleFarkle]);

  // ── Bank: pass scored amount + faces to dream-core wrapper ──────────────
  const onBank = useCallback(() => {
    if (unbanked <= 0 || isFarkle) return;
    const wrapped = handleBank(unbanked, currentFaces.map(Number), banked);
    setBanked(prev => prev + wrapped);
    setUnbanked(0);
    setCurrentFaces([]);
    setScoringMask([]);
    setIsFarkle(false);
  }, [unbanked, isFarkle, currentFaces, banked, handleBank]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'var(--dream-black)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: 'var(--font-mono)',
    }}>
      {/* Vignette overlay (always mounted, visibility controlled by heartbeat) */}
      <VignetteOverlay />

      {/* Top bar: Chapter + Oscilloscope */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--dream-border)',
        background: 'var(--dream-void)',
        zIndex: 10,
      }}>
        <div style={{ minWidth: '140px' }}>
          <div className="hud-label">CHAPTER</div>
          <div style={{
            fontFamily: 'var(--font-gothic)',
            fontSize: '14px',
            fontWeight: 700,
            color: heartbeat.active ? '#ff3333' : 'var(--neon-cyan)',
          }}>
            {heroJourney.chapter.replace(/_/g, ' ')}
          </div>
        </div>
        <NeonOscilloscope width={300} height={48} />
        <BeatHighway width={300} />
        <TrickMeterBar />
      </header>

      {/* Main content area */}
      <main style={{
        flex: 1,
        display: 'flex',
        gap: '16px',
        padding: '16px',
        overflow: 'hidden',
      }}>
        {/* Class selector overlay */}
        {gamePhase === 'CLASS_SELECT' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(5, 5, 8, 0.9)',
            zIndex: 100,
          }}>
            <ClassSelector onSelect={handleClassSelected} />
          </div>
        )}

        {/* Facet draft overlay */}
        {showDraft && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(5, 5, 8, 0.9)',
            zIndex: 100,
          }}>
            <FacetDraftPanel onSelect={handleFacetDrafted} />
          </div>
        )}

        {/* Left: Game Board */}
        <div style={{ flex: '0 0 520px' }}>
          <DreamGameBoard playerId={playerId} />
        </div>

        {/* Center: Dice + Actions */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isFarkle && (
            <div style={{
              fontSize: '28px',
              fontWeight: 900,
              color: '#ff3333',
              textShadow: '0 0 20px #ff0000',
              letterSpacing: '0.2em',
              animation: 'pulse 0.5s ease-in-out',
            }}>
              FARKLE
            </div>
          )}

          <DiceDisplay
            faces={currentFaces.length > 0 ? currentFaces : [1, 2, 3, 4, 5, 6]}
            scoringMask={scoringMask.length > 0 ? scoringMask : [false, false, false, false, false, false]}
          />

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <ActionButton
              label="ROLL"
              color="var(--neon-cyan)"
              onClick={onRoll}
              disabled={gamePhase !== 'PLAYING'}
            />
            <ActionButton
              label="BANK"
              color="var(--neon-gold)"
              onClick={onBank}
              disabled={unbanked <= 0 || isFarkle || gamePhase !== 'PLAYING'}
            />
            <ActionButton
              label="COMBO BREAK"
              color="var(--neon-magenta)"
              onClick={handleComboBreaker}
              small
              disabled={!isFarkle}
            />
          </div>
        </div>

        {/* Right: HUD */}
        <div style={{ flex: '0 0 280px', overflowY: 'auto' }}>
          <DreamHUD />
        </div>
      </main>

      {/* Footer: Score display */}
      <footer style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 24px',
        borderTop: '1px solid var(--dream-border)',
        background: 'var(--dream-void)',
      }}>
        <div>
          <span className="hud-label">UNBANKED</span>
          <span className="hud-value neon-text" style={{ marginLeft: 8 }}>{unbanked}</span>
        </div>
        <div>
          <span className="hud-label">BANKED</span>
          <span className="hud-value neon-text--gold" style={{ marginLeft: 8 }}>{banked}</span>
        </div>
        <div>
          <span className="hud-label">TURN</span>
          <span className="hud-value" style={{ marginLeft: 8, color: 'rgba(224,224,232,0.7)' }}>
            {heroJourney.turnNumber}
          </span>
        </div>
        {selectedClass && (
          <div>
            <span className="hud-label">CLASS</span>
            <span className="hud-value" style={{ marginLeft: 8, color: 'var(--neon-gold)', fontSize: '12px' }}>
              {selectedClass}
            </span>
          </div>
        )}
      </footer>
    </div>
  );
};

// ── Action Button Sub-Component ───────────────────────────────────────────────

interface ActionButtonProps {
  label: string;
  color: string;
  onClick: () => void;
  small?: boolean;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  color,
  onClick,
  small = false,
  disabled = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: small ? '8px 16px' : '12px 32px',
      background: 'transparent',
      border: `1px solid ${color}`,
      borderRadius: '6px',
      color,
      fontFamily: 'var(--font-mono)',
      fontSize: small ? '10px' : '13px',
      fontWeight: 700,
      letterSpacing: '0.1em',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'all 0.15s ease',
      textTransform: 'uppercase',
    }}
  >
    {label}
  </button>
);
