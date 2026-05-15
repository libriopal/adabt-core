// ─────────────────────────────────────────────────────
// DREAM-CORE — Game Board Component
// 60-tile grid with territory overlay, sealed tiles,
// scorched tiles (Battle Royale), and gravity rotation.
// ─────────────────────────────────────────────────────

import React, { useMemo, useCallback } from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import { isTileScorched, getScorchedVisuals } from '../../../../../packages/dream-core/src/genres/battle-royale';
import { getGravityTransform, getSettleCSS } from '../../../../../packages/dream-core/src/genres/platformer';
import { getTerritoryVisuals } from '../../../../../packages/dream-core/src/genres/strategy';

interface DreamGameBoardProps {
  playerId: string;
  onTileClick?: (tileIndex: number) => void;
  className?: string;
}

const COLS = 10;
const ROWS = 6;

export const DreamGameBoard: React.FC<DreamGameBoardProps> = ({
  playerId,
  onTileClick,
  className = '',
}) => {
  const sealedTiles = useDreamStore(s => s.sealedTiles);
  const closingCircle = useDreamStore(s => s.closingCircle);
  const gravity = useDreamStore(s => s.gravity);
  const territory = useDreamStore(s => s.territory);

  const gravityTransform = getGravityTransform(gravity.currentDirection);
  const settleCSS = getSettleCSS(gravity.settling);
  const territoryVis = getTerritoryVisuals(territory, playerId);
  const scorchedVis = getScorchedVisuals(closingCircle);

  const tiles = useMemo(() => {
    const result: TileInfo[] = [];
    for (let i = 0; i < ROWS * COLS; i++) {
      const sealed = sealedTiles.find(s => s.tileIndex === i);
      const scorched = isTileScorched(closingCircle, i);
      const territoryTile = territoryVis.territories.find(
        t => t.tileIndices.includes(i)
      );

      result.push({
        index: i,
        row: Math.floor(i / COLS),
        col: i % COLS,
        sealed: sealed?.sealed ?? false,
        sealCondition: sealed?.condition ?? '',
        scorched,
        territoryOwned: territoryTile?.owned ?? false,
        territoryContested: territoryTile?.contested ?? false,
        territoryDomain: territoryTile?.domainActive ?? false,
        territoryColor: territoryTile?.color ?? 'transparent',
        territoryBorder: territoryTile?.borderStyle ?? 'solid',
      });
    }
    return result;
  }, [sealedTiles, closingCircle, territoryVis]);

  const handleTileClick = useCallback((index: number) => {
    onTileClick?.(index);
  }, [onTileClick]);

  return (
    <div
      className={`glass-panel ${className}`}
      style={{
        padding: '16px',
        transform: gravityTransform,
        ...settleCSS,
      }}
    >
      {/* Grid Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <span className="gothic-header gothic-header--sm neon-text">
          THE GRID
        </span>
        <span className="hud-label">
          GRAVITY: {gravity.currentDirection} | TURN {gravity.turnsSinceFlip + 1}/{gravity.flipInterval}
        </span>
      </div>

      {/* Scorched border indicator */}
      {closingCircle.active && (
        <div style={{
          marginBottom: '8px',
          padding: '4px 8px',
          background: 'rgba(255, 60, 20, 0.1)',
          border: '1px solid rgba(255, 60, 20, 0.3)',
          borderRadius: '4px',
          fontSize: '10px',
          color: scorchedVis.borderColor,
          fontFamily: 'var(--font-mono)',
        }}>
          ⚠ CIRCLE CLOSING — {60 - closingCircle.scorched.size} tiles remain
        </div>
      )}

      {/* Tile Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 48px)`,
        gridTemplateRows: `repeat(${ROWS}, 48px)`,
        gap: '2px',
      }}>
        {tiles.map(tile => (
          <div
            key={tile.index}
            className={[
              'grid-tile',
              tile.sealed && 'grid-tile--sealed',
              tile.scorched && 'grid-tile--scorched',
              tile.territoryOwned && 'grid-tile--territory',
              tile.territoryDomain && 'grid-tile--domain',
            ].filter(Boolean).join(' ')}
            style={{
              borderColor: tile.territoryOwned
                ? tile.territoryColor
                : undefined,
              borderStyle: tile.territoryBorder,
              cursor: tile.scorched ? 'not-allowed' : 'pointer',
            }}
            onClick={() => !tile.scorched && handleTileClick(tile.index)}
            title={
              tile.sealed
                ? `Sealed: ${tile.sealCondition}`
                : tile.scorched
                  ? 'Scorched'
                  : `Tile ${tile.index}`
            }
          >
            {tile.sealed && (
              <span style={{
                fontSize: '16px',
                opacity: 0.6,
                animation: 'pulse-glow 2s ease-in-out infinite',
              }}>
                🔒
              </span>
            )}
            {tile.scorched && (
              <span style={{ fontSize: '14px', opacity: 0.5 }}>
                🔥
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Territory Bonus */}
      {territoryVis.hasDomain && (
        <div style={{
          marginTop: '8px',
          textAlign: 'center',
          fontSize: '12px',
          fontWeight: 700,
          color: '#00ffcc',
          textShadow: '0 0 8px rgba(0, 255, 204, 0.5)',
        }}>
          ⚔ DOMAIN ACTIVE — {territoryVis.bonusLabel} bonus
        </div>
      )}
    </div>
  );
};

interface TileInfo {
  index: number;
  row: number;
  col: number;
  sealed: boolean;
  sealCondition: string;
  scorched: boolean;
  territoryOwned: boolean;
  territoryContested: boolean;
  territoryDomain: boolean;
  territoryColor: string;
  territoryBorder: string;
}
