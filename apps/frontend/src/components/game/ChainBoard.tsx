// ─────────────────────────────────────────────────────
// ChainBoard — interactive grid-chain-drawing component
//
// Displays a Cell[][] grid. Player draws a connected chain of adjacent cells
// (8-directional). Chain is scored via scoreFarkle on the selected faces.
// Valid chain (length ≥ 2, score > 0) is committed via onChainCommit.
//
// Design: Organic Vegas r1 design tokens (design_tokens.json).
// Performance: no per-sample React re-render; pointer events on native DOM.
// ─────────────────────────────────────────────────────

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import type { Cell, DieFace, GridPos } from '@match3d/farkle-shared';
import { GAME_CONSTANTS } from '@match3d/farkle-shared';
import { scoreFarkle } from '@match3d/farkle-engine';

// ── Design tokens (organic-vegas-sot-r1) ─────────────────────────────────────

const TOKEN = {
  tileSize: 52,          // px — target from design_tokens.json
  tileGap:   6,          // px
  tileBorder: 1,         // px hairline
  tileRadius: 6,         // px
  voidBg:    '#050008',
  tileBg:    '#0d0712',
  tileStroke:'rgba(201,168,76,0.38)',
  chainStroke:'#3388ff',
  chainGlow:  'rgba(51,136,255,0.55)',
  validStroke:'#c8d400',
  validGlow:  'rgba(200,212,0,0.45)',
  farkleStroke:'#ff2b55',
  farkleGlow: 'rgba(255,43,85,0.45)',
  goldStroke: '#c9a84c',
  disabledBg:'#17060d',
} as const;

// Die face → colour (from FACE_TO_COLOR + design token palette)
const FACE_HEX: Record<DieFace, string> = {
  1: '#f43f5e',  // red
  2: '#f97316',  // orange
  3: '#fbbf24',  // amber
  4: '#10b981',  // emerald
  5: '#38bdf8',  // sky
  6: '#7c3aed',  // violet
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChainCommitPayload {
  chain: GridPos[];
  faces: DieFace[];
  score: number;
}

interface ChainBoardProps {
  grid: Cell[][];
  canAct: boolean;
  lastFarkle?: boolean;
  onChainCommit: (payload: ChainCommitPayload) => void;
  className?: string;
}

// ── Adjacency helper ──────────────────────────────────────────────────────────

function isAdjacent(a: GridPos, b: GridPos): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 &&
    !(a.row === b.row && a.col === b.col);
}

function posKey(p: GridPos): string { return `${p.row}:${p.col}`; }

// ── Chain score preview ───────────────────────────────────────────────────────

function chainScore(chain: GridPos[], grid: Cell[][]): { score: number; isFarkle: boolean; combo: string } {
  if (chain.length < GAME_CONSTANTS.minChainLength) {
    return { score: 0, isFarkle: false, combo: '' };
  }
  const faces = chain
    .map(p => grid[p.row]?.[p.col]?.face)
    .filter((f): f is DieFace => f !== null && f !== undefined);
  if (faces.length !== chain.length) return { score: 0, isFarkle: true, combo: 'BLOCKED' };
  const result = scoreFarkle(faces);
  return { score: result.score, isFarkle: result.isFarkle, combo: result.combo };
}

// ── Cell visual state ─────────────────────────────────────────────────────────

type CellVisual = 'idle' | 'in-chain' | 'chainable' | 'farkle-chain' | 'blocked' | 'last';

function cellVisual(
  cell: Cell,
  pos: GridPos,
  chain: GridPos[],
  isChaining: boolean,
  isFarklePreview: boolean,
): CellVisual {
  if (cell.state === 'FROZEN' || cell.state === 'LOCKED' || cell.face === null) return 'blocked';
  const inChain = chain.some(p => p.row === pos.row && p.col === pos.col);
  if (inChain) return isFarklePreview ? 'farkle-chain' : 'in-chain';
  if (isChaining && chain.length > 0) {
    const tail = chain[chain.length - 1]!;
    const alreadyVisited = chain.some(p => p.row === pos.row && p.col === pos.col);
    if (!alreadyVisited && isAdjacent(tail, pos)) return 'chainable';
  }
  return 'idle';
}

function visualStyle(v: CellVisual): React.CSSProperties {
  switch (v) {
    case 'in-chain':    return { background: '#15101b', borderColor: TOKEN.chainStroke, boxShadow: `0 0 12px ${TOKEN.chainGlow}` };
    case 'farkle-chain':return { background: '#17060d', borderColor: TOKEN.farkleStroke, boxShadow: `0 0 12px ${TOKEN.farkleGlow}` };
    case 'chainable':   return { background: '#12170a', borderColor: TOKEN.validStroke, boxShadow: `0 0 10px ${TOKEN.validGlow}` };
    case 'blocked':     return { background: TOKEN.disabledBg, borderColor: '#5a5260', opacity: 0.5 };
    default:            return { background: TOKEN.tileBg, borderColor: TOKEN.tileStroke };
  }
}

// ── ChainBoard ────────────────────────────────────────────────────────────────

export const ChainBoard: React.FC<ChainBoardProps> = ({
  grid,
  canAct,
  lastFarkle = false,
  onChainCommit,
  className = '',
}) => {
  const [chain, setChain] = useState<GridPos[]>([]);
  const [isChaining, setIsChaining] = useState(false);
  const chainRef = useRef<GridPos[]>([]);
  const isChainingRef = useRef(false);

  // Keep refs in sync for pointer handlers (closure-safe)
  useEffect(() => { chainRef.current = chain; }, [chain]);
  useEffect(() => { isChainingRef.current = isChaining; }, [isChaining]);

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  // Live score preview
  const preview = useMemo(() => chainScore(chain, grid), [chain, grid]);

  // ── Pointer handlers ───────────────────────────────────────────────────────

  const getCellFromPoint = useCallback(
    (clientX: number, clientY: number, containerEl: HTMLElement): GridPos | null => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const tileEl = el.closest<HTMLElement>('[data-cell]');
      if (!tileEl || !containerEl.contains(tileEl)) return null;
      const r = parseInt(tileEl.dataset['row'] ?? '', 10);
      const c = parseInt(tileEl.dataset['col'] ?? '', 10);
      if (isNaN(r) || isNaN(c)) return null;
      return { row: r, col: c };
    },
    [],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const startChain = useCallback((pos: GridPos) => {
    const cell = grid[pos.row]?.[pos.col];
    if (!cell || cell.face === null || cell.state === 'FROZEN' || cell.state === 'LOCKED') return;
    const newChain = [pos];
    chainRef.current = newChain;
    isChainingRef.current = true;
    setChain(newChain);
    setIsChaining(true);
  }, [grid]);

  const extendChain = useCallback((pos: GridPos) => {
    const cur = chainRef.current;
    if (cur.length === 0) return;
    const visited = new Set(cur.map(posKey));
    if (visited.has(posKey(pos))) return;
    const tail = cur[cur.length - 1]!;
    if (!isAdjacent(tail, pos)) return;
    const cell = grid[pos.row]?.[pos.col];
    if (!cell || cell.face === null || cell.state === 'FROZEN' || cell.state === 'LOCKED') return;
    if (cur.length >= GAME_CONSTANTS.maxChainLength) return;
    const newChain = [...cur, pos];
    chainRef.current = newChain;
    setChain(newChain);
  }, [grid]);

  const commitChain = useCallback(() => {
    const cur = chainRef.current;
    isChainingRef.current = false;
    setIsChaining(false);
    if (cur.length >= GAME_CONSTANTS.minChainLength) {
      const { score, isFarkle } = chainScore(cur, grid);
      if (!isFarkle && score > 0) {
        const faces = cur
          .map(p => grid[p.row]?.[p.col]?.face)
          .filter((f): f is DieFace => f !== null && f !== undefined);
        onChainCommit({ chain: cur, faces, score });
      }
    }
    chainRef.current = [];
    setChain([]);
  }, [grid, onChainCommit]);

  const cancelChain = useCallback(() => {
    isChainingRef.current = false;
    chainRef.current = [];
    setChain([]);
    setIsChaining(false);
  }, []);

  // Pointer event wiring on the container (single listener, no per-tile overhead)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      if (!canAct) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const pos = getCellFromPoint(e.clientX, e.clientY, el);
      if (pos) startChain(pos);
    };

    const onMove = (e: PointerEvent) => {
      if (!isChainingRef.current) return;
      e.preventDefault();
      const pos = getCellFromPoint(e.clientX, e.clientY, el);
      if (pos) extendChain(pos);
    };

    const onUp = (e: PointerEvent) => {
      if (!isChainingRef.current) return;
      e.preventDefault();
      el.releasePointerCapture(e.pointerId);
      commitChain();
    };

    const onCancel = () => cancelChain();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  }, [canAct, startChain, extendChain, commitChain, cancelChain, getCellFromPoint]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const chainedKeys = useMemo(() => new Set(chain.map(posKey)), [chain]);

  const scoreColor = preview.isFarkle
    ? TOKEN.farkleStroke
    : preview.score > 0
      ? TOKEN.validStroke
      : TOKEN.tileStroke;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', userSelect: 'none' }}>

      {/* ── Score preview bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 16px',
        background: 'rgba(5,0,8,0.86)',
        border: `1px solid ${scoreColor}`,
        borderRadius: 6,
        boxShadow: preview.score > 0 ? `0 0 10px ${scoreColor}55` : 'none',
        transition: 'border-color 110ms, box-shadow 110ms',
        minWidth: 200,
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: 'var(--ov-bone-shadow, #c9a84c66)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
          {chain.length === 0 ? 'DRAW A CHAIN' : `CHAIN ×${chain.length}`}
        </span>
        <span style={{ fontSize: 20, fontWeight: 900, color: scoreColor, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          {preview.isFarkle ? 'FARKLE' : preview.score > 0 ? `+${preview.score}` : chain.length > 0 ? '—' : ''}
        </span>
        {preview.combo && !preview.isFarkle && (
          <span style={{ fontSize: 10, color: TOKEN.goldStroke, letterSpacing: '0.1em', fontFamily: 'monospace' }}>
            {preview.combo.toUpperCase()}
          </span>
        )}
      </div>

      {/* ── Farkle warning ── */}
      {lastFarkle && (
        <div style={{ fontSize: 11, color: TOKEN.farkleStroke, letterSpacing: '0.15em', fontFamily: 'monospace', animation: 'pulse-glow 1s ease infinite' }}>
          FARKLE — ALL UNBANKED LOST
        </div>
      )}

      {/* ── The grid ── */}
      <div
        ref={containerRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${TOKEN.tileSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${TOKEN.tileSize}px)`,
          gap: TOKEN.tileGap,
          touchAction: 'none',
          cursor: canAct ? 'crosshair' : 'not-allowed',
          padding: 8,
          background: 'rgba(5,0,8,0.72)',
          borderRadius: 8,
          border: `1px solid rgba(201,168,76,0.18)`,
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const cell = grid[r]![c]!;
            const pos: GridPos = { row: r, col: c };
            const vis = cellVisual(cell, pos, chain, isChaining, preview.isFarkle && chain.length >= 2);
            const vstyle = visualStyle(vis);
            const isInChain = chainedKeys.has(posKey(pos));
            const chainIdx = isInChain ? chain.findIndex(p => p.row === r && p.col === c) : -1;

            return (
              <div
                key={`${r}-${c}`}
                data-cell
                data-row={r}
                data-col={c}
                style={{
                  width: TOKEN.tileSize,
                  height: TOKEN.tileSize,
                  borderRadius: TOKEN.tileRadius,
                  border: `${TOKEN.tileBorder}px solid ${vstyle.borderColor ?? TOKEN.tileStroke}`,
                  background: vstyle.background as string,
                  boxShadow: vstyle.boxShadow as string | undefined,
                  opacity: vstyle.opacity as number | undefined,
                  transition: 'background 55ms, border-color 55ms, box-shadow 55ms',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Die face indicator (color dot + number) */}
                {cell.face !== null && cell.state !== 'FROZEN' && cell.state !== 'LOCKED' && (
                  <>
                    <div style={{
                      width: 20, height: 20,
                      borderRadius: '50%',
                      background: FACE_HEX[cell.face],
                      boxShadow: isInChain ? `0 0 8px ${FACE_HEX[cell.face]}` : 'none',
                      transition: 'box-shadow 55ms',
                    }} />
                    <span style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: '#fff',
                      fontFamily: 'monospace',
                      marginTop: 2,
                      textShadow: `0 0 6px ${FACE_HEX[cell.face]}`,
                    }}>
                      {cell.face}
                    </span>
                  </>
                )}

                {/* Frozen tile */}
                {cell.state === 'FROZEN' && (
                  <span style={{ fontSize: 16, opacity: 0.6 }}>❄</span>
                )}

                {/* Locked tile */}
                {cell.state === 'LOCKED' && (
                  <span style={{ fontSize: 14, opacity: 0.7 }}>🔒</span>
                )}

                {/* Null face (stone/blocker) */}
                {cell.face === null && cell.state === 'NORMAL' && (
                  <span style={{ fontSize: 14, opacity: 0.4 }}>◆</span>
                )}

                {/* Chain order badge */}
                {isInChain && chainIdx >= 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 2, right: 3,
                    fontSize: 9,
                    fontWeight: 900,
                    color: preview.isFarkle ? TOKEN.farkleStroke : TOKEN.chainStroke,
                    fontFamily: 'monospace',
                    lineHeight: 1,
                  }}>
                    {chainIdx + 1}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Not your turn overlay ── */}
      {!canAct && (
        <div style={{ fontSize: 11, color: TOKEN.goldStroke, letterSpacing: '0.15em', fontFamily: 'monospace' }}>
          OPPONENT'S TURN
        </div>
      )}
    </div>
  );
};
