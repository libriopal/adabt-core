// ─────────────────────────────────────────────────────
// DREAM-CORE — Main Game Application
// Orchestrates all game components into a single view.
// Dark Gothic Hacker aesthetic — the game IS music.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import { useDreamCore } from '../../hooks/useDreamCore';

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
import type { DieFace } from '../../../../../packages/dream-core/src/types';

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

  // Mock game state (to be connected to farkle engine)
  const [currentFaces, setCurrentFaces] = useState<DieFace[]>([]);
  const [scoringMask, setScoringMask] = useState<boolean[]>([]);
  const [showDraft, setShowDraft] = useState(false);
  const [gamePhase, setGamePhase] = useState<'CLASS_SELECT' | 'PLAYING' | 'DRAFT'>('CLASS_SELECT');

  const handleClassSelected = useCallback(() => {
    setGamePhase('PLAYING');
  }, []);

  const handleFacetDrafted = useCallback(() => {
    setShowDraft(false);
    setGamePhase('PLAYING');
  }, []);

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
          {/* Dice Display */}
          <DiceDisplay
            faces={currentFaces.length > 0 ? currentFaces : [1, 2, 3, 4, 5, 6]}
            scoringMask={scoringMask.length > 0 ? scoringMask : [true, false, false, false, true, false]}
          />

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
          }}>
            <ActionButton
              label="ROLL"
              color="var(--neon-cyan)"
              onClick={() => {
                audio.resume();
                handleRoll();
              }}
            />
            <ActionButton
              label="BANK"
              color="var(--neon-gold)"
              onClick={() => handleBank(500, [1, 5, 3, 2, 4, 6], 0)}
            />
            <ActionButton
              label="COMBO BREAK"
              color="var(--neon-magenta)"
              onClick={handleComboBreaker}
              small
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
          <span className="hud-value neon-text" style={{ marginLeft: 8 }}>0</span>
        </div>
        <div>
          <span className="hud-label">BANKED</span>
          <span className="hud-value neon-text--gold" style={{ marginLeft: 8 }}>0</span>
        </div>
        <div>
          <span className="hud-label">TURN</span>
          <span className="hud-value" style={{ marginLeft: 8, color: 'rgba(224,224,232,0.7)' }}>
            {heroJourney.turnNumber}
          </span>
        </div>
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
