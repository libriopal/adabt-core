// ─────────────────────────────────────────────────────
// DREAM-CORE — Dice Display Component
// Glass/Gold material dice with scoring indicators,
// reveal delays for near-miss psychology, and
// Hidden Pocket interaction.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import type { DieFace } from '../../../../../packages/dream-core/src/types';

interface DiceDisplayProps {
  faces: DieFace[];
  scoringMask: boolean[];  // which dice are scoring
  onPocketDie?: (index: number) => void;
  nearMissPatterns?: NearMissInfo[];
  className?: string;
}

interface NearMissInfo {
  dieIndex: number;
  patternName: string;
  revealDelayMs: number;
}

export const DiceDisplay: React.FC<DiceDisplayProps> = ({
  faces,
  scoringMask,
  onPocketDie,
  nearMissPatterns = [],
  className = '',
}) => {
  const hiddenPocket = useDreamStore(s => s.hiddenPocket);
  const diceClass = useDreamStore(s => s.diceClass);
  const trickMeter = useDreamStore(s => s.trickMeter);
  const buildADie = useDreamStore(s => s.buildADie);
  const pocket = useDreamStore(s => s.pocket);

  const [revealedDice, setRevealedDice] = useState<Set<number>>(new Set());
  const [pocketingIndex, setPocketingIndex] = useState<number | null>(null);

  // ── Reveal Delay (Near-Miss Psychology) ─────────────────────────────────────
  useEffect(() => {
    // If there are near-miss patterns, delay revealing those dice
    if (nearMissPatterns.length === 0) {
      // Reveal all immediately
      setRevealedDice(new Set(faces.map((_, i) => i)));
      return;
    }

    // Reveal non-near-miss dice immediately
    const immediate = new Set(faces.map((_, i) => i).filter(
      i => !nearMissPatterns.some(nm => nm.dieIndex === i)
    ));
    setRevealedDice(immediate);

    // Stagger reveal for near-miss dice
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (const nm of nearMissPatterns) {
      const timeout = setTimeout(() => {
        setRevealedDice(prev => new Set([...prev, nm.dieIndex]));
      }, nm.revealDelayMs);
      timeouts.push(timeout);
    }

    return () => timeouts.forEach(clearTimeout);
  }, [faces, nearMissPatterns]);

  // ── Pocket Handler ──────────────────────────────────────────────────────────
  const handlePocket = useCallback((index: number) => {
    if (!scoringMask[index]) return; // can only pocket scoring dice
    if (hiddenPocket.pocketedDie !== null) return; // pocket full

    const face = faces[index]!;
    const success = pocket(face);
    if (success) {
      setPocketingIndex(index);
      onPocketDie?.(index);
      setTimeout(() => setPocketingIndex(null), 400);
    }
  }, [faces, scoringMask, hiddenPocket, pocket, onPocketDie]);

  return (
    <div className={className} style={{
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px',
    }}>
      {faces.map((face, index) => {
        const isScoring = scoringMask[index] ?? false;
        const isRevealed = revealedDice.has(index);
        const isPocketing = pocketingIndex === index;
        const isNearMiss = nearMissPatterns.some(nm => nm.dieIndex === index);
        const isCustomDie = buildADie.deployed && index === faces.length - 1;

        // Material selection based on state
        let materialClass = 'die--glass';
        if (isCustomDie) materialClass = 'die--obsidian';
        if (trickMeter.level === 'FRENZY') materialClass = 'die--neon';
        if (isScoring) materialClass += ' die--scoring';
        if (isPocketing) materialClass += ' die--pocketed';

        return (
          <div
            key={index}
            className={`die ${materialClass}`}
            style={{
              opacity: isRevealed ? 1 : 0.15,
              transform: isRevealed
                ? (isPocketing ? 'scale(0.85) translateY(-8px)' : 'none')
                : 'rotateY(90deg)',
              transition: isNearMiss
                ? 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'all 0.15s ease',
              position: 'relative',
            }}
            onClick={() => isScoring && handlePocket(index)}
            title={isScoring ? 'Click to pocket this die' : undefined}
          >
            {/* Die face */}
            <span style={{
              fontSize: isRevealed ? '20px' : '0px',
              transition: 'font-size 0.2s ease',
            }}>
              {isRevealed ? face : '?'}
            </span>

            {/* Scoring indicator */}
            {isScoring && isRevealed && (
              <div style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--neon-cyan)',
                boxShadow: '0 0 6px var(--neon-cyan)',
              }} />
            )}

            {/* Near-miss suspense effect */}
            {isNearMiss && !isRevealed && (
              <div style={{
                position: 'absolute',
                inset: -2,
                border: '2px solid var(--neon-magenta)',
                borderRadius: '10px',
                animation: 'pulse-glow 0.5s ease-in-out infinite',
              }} />
            )}

            {/* Custom die indicator */}
            {isCustomDie && (
              <div style={{
                position: 'absolute',
                bottom: -6,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '8px',
                color: 'var(--neon-cyan)',
                whiteSpace: 'nowrap',
              }}>
                CUSTOM
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
