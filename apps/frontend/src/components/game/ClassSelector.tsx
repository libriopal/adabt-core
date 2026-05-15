// ─────────────────────────────────────────────────────
// DREAM-CORE — Class Selector Component
// Pre-match class selection: Paladin, Rogue, Bard, Artificer.
// ─────────────────────────────────────────────────────

import React, { useCallback } from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import { DICE_CLASS_REGISTRY } from '../../../../../packages/dream-core/src/genres/rpg';
import type { DiceClass } from '../../../../../packages/dream-core/src/types';

interface ClassSelectorProps {
  onSelect?: (diceClass: DiceClass) => void;
  className?: string;
}

const CLASS_ICONS: Record<DiceClass, string> = {
  PALADIN: '🛡️',
  ROGUE: '🗡️',
  BARD: '🎵',
  ARTIFICER: '⚙️',
};

const CLASS_COLORS: Record<DiceClass, string> = {
  PALADIN: '#4488ff',
  ROGUE: '#ff4444',
  BARD: '#ffaa00',
  ARTIFICER: '#00ffcc',
};

export const ClassSelector: React.FC<ClassSelectorProps> = ({
  onSelect,
  className = '',
}) => {
  const selectedClass = useDreamStore(s => s.diceClass.selectedClass);
  const selectClass = useDreamStore(s => s.selectClass);

  const handleSelect = useCallback((diceClass: DiceClass) => {
    if (selectedClass !== null) return; // immutable after selection
    selectClass(diceClass);
    onSelect?.(diceClass);
  }, [selectedClass, selectClass, onSelect]);

  if (selectedClass !== null) return null; // hide after selection

  return (
    <div className={`glass-panel ${className}`} style={{ padding: '24px' }}>
      <h2 className="gothic-header gothic-header--md neon-text" style={{
        textAlign: 'center',
        marginBottom: '20px',
      }}>
        CHOOSE YOUR CLASS
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}>
        {(Object.keys(DICE_CLASS_REGISTRY) as DiceClass[]).map(cls => {
          const def = DICE_CLASS_REGISTRY[cls];
          const color = CLASS_COLORS[cls];

          return (
            <button
              key={cls}
              onClick={() => handleSelect(cls)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '16px',
                background: 'rgba(10, 10, 18, 0.85)',
                border: `1px solid ${color}30`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                color: '#e0e0e8',
                fontFamily: 'var(--font-mono)',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.borderColor = `${color}80`;
                (e.target as HTMLElement).style.boxShadow = `0 0 16px ${color}20`;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.borderColor = `${color}30`;
                (e.target as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '28px' }}>{CLASS_ICONS[cls]}</span>
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                color,
                letterSpacing: '0.1em',
              }}>
                {def.name.toUpperCase()}
              </span>
              <span style={{
                fontSize: '10px',
                color: 'rgba(224, 224, 232, 0.6)',
                textAlign: 'center',
              }}>
                {def.passive}
              </span>
              <span style={{
                fontSize: '10px',
                color: `${color}88`,
                textAlign: 'center',
                fontStyle: 'italic',
              }}>
                {def.ability}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
