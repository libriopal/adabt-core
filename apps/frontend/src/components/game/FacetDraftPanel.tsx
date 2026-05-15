// ─────────────────────────────────────────────────────
// DREAM-CORE — Facet Draft Panel Component
// Roguelike facet selection between rounds.
// 3 options, pick 1 — Balatro-style drafting.
// ─────────────────────────────────────────────────────

import React, { useCallback, useMemo } from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import { FACET_REGISTRY, generateDraftOptions } from '../../../../../packages/dream-core/src/genres/roguelike';
import type { FacetId } from '../../../../../packages/dream-core/src/types';

interface FacetDraftPanelProps {
  onSelect?: (facetId: FacetId) => void;
  className?: string;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: '#aaaaaa',
  UNCOMMON: '#44cc44',
  RARE: '#4488ff',
  LEGENDARY: '#ffaa00',
};

export const FacetDraftPanel: React.FC<FacetDraftPanelProps> = ({
  onSelect,
  className = '',
}) => {
  const facetState = useDreamStore(s => s.facet);
  const equipFacet = useDreamStore(s => s.equipFacet);

  // Generate 3 draft options
  const options = useMemo(() => {
    return generateDraftOptions(facetState, 3, Math.random);
  }, [facetState.round]);

  const handleSelect = useCallback((facetId: FacetId) => {
    equipFacet(facetId);
    onSelect?.(facetId);
  }, [equipFacet, onSelect]);

  if (options.length === 0) return null;

  return (
    <div className={`glass-panel ${className}`} style={{ padding: '20px' }}>
      <h3 className="gothic-header gothic-header--sm neon-text--magenta" style={{
        textAlign: 'center',
        marginBottom: '16px',
      }}>
        FACET MUTATION — CHOOSE ONE
      </h3>

      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
      }}>
        {options.map(facetId => {
          const facet = FACET_REGISTRY[facetId]!;
          const rarityColor = RARITY_COLORS[facet.rarity] ?? '#aaaaaa';

          return (
            <button
              key={facetId}
              onClick={() => handleSelect(facetId)}
              style={{
                flex: '1 1 0',
                maxWidth: '200px',
                padding: '16px',
                background: 'var(--dream-surface)',
                border: `1px solid ${rarityColor}40`,
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#e0e0e8',
                fontFamily: 'var(--font-mono)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: rarityColor,
                letterSpacing: '0.15em',
                marginBottom: '6px',
              }}>
                {facet.rarity}
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '8px',
              }}>
                {facet.name}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(224, 224, 232, 0.6)',
                lineHeight: 1.4,
              }}>
                {facet.description}
              </div>
              {facet.mutation && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '10px',
                  color: '#ff00ff',
                  fontStyle: 'italic',
                }}>
                  Mutates after 3 rounds
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
