// ─────────────────────────────────────────────────────
// DREAM-CORE — Heads-Up Display
// Top-level HUD showing all active genre indicators.
// Dark Gothic Hacker aesthetic with Glass panels.
// ─────────────────────────────────────────────────────

import React from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import { getTokenVisuals } from '../../../../../packages/dream-core/src/genres/fps';
import { getTrickMeterVisuals } from '../../../../../packages/dream-core/src/genres/sports';
import { getUltimateVisuals } from '../../../../../packages/dream-core/src/genres/moba';
import { getChapterVisuals } from '../../../../../packages/dream-core/src/genres/adventure';
import { getSlipstreamVisuals } from '../../../../../packages/dream-core/src/genres/racing';
import { getPocketVisuals } from '../../../../../packages/dream-core/src/genres/stealth';
import { getRuleShardVisuals } from '../../../../../packages/dream-core/src/genres/abstract';

export const DreamHUD: React.FC = () => {
  const precisionStrike = useDreamStore(s => s.precisionStrike);
  const trickMeter = useDreamStore(s => s.trickMeter);
  const ultimate = useDreamStore(s => s.ultimate);
  const heroJourney = useDreamStore(s => s.heroJourney);
  const slipstream = useDreamStore(s => s.slipstream);
  const hiddenPocket = useDreamStore(s => s.hiddenPocket);
  const ruleShard = useDreamStore(s => s.ruleShard);
  const territory = useDreamStore(s => s.territory);
  const diceClass = useDreamStore(s => s.diceClass);
  const heartbeat = useDreamStore(s => s.heartbeat);

  const tokenVis = getTokenVisuals(precisionStrike);
  const trickVis = getTrickMeterVisuals(trickMeter);
  const ultVis = getUltimateVisuals(ultimate);
  const chapterVis = getChapterVisuals(heroJourney);
  const slipVis = getSlipstreamVisuals(slipstream);
  const pocketVis = getPocketVisuals(hiddenPocket);
  const ruleVis = getRuleShardVisuals(ruleShard, Date.now());

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: '8px',
      padding: '8px',
    }}>
      {/* Chapter Indicator */}
      <HUDPanel
        label="CHAPTER"
        value={chapterVis.chapterName}
        subValue={chapterVis.musicalKey}
        color={chapterVis.chapterColor}
      />

      {/* Dice Class */}
      {diceClass.selectedClass && (
        <HUDPanel
          label="CLASS"
          value={diceClass.selectedClass}
          subValue={diceClass.classAbilityCharges > 0 ? 'ABILITY READY' : 'ABILITY USED'}
          color={diceClass.classAbilityCharges > 0 ? '#00ffcc' : '#666'}
        />
      )}

      {/* Trick Meter */}
      <HUDPanel label="TRICK" value={trickVis.level} color={trickVis.fillColor}>
        <div className="meter" style={{ marginTop: 4 }}>
          <div
            className="meter__fill"
            style={{
              width: `${trickVis.progress * 100}%`,
              background: trickVis.fillColor,
              boxShadow: `0 0 8px ${trickVis.fillColor}`,
            }}
          />
        </div>
      </HUDPanel>

      {/* Precision Strike Tokens */}
      <HUDPanel
        label="TOKENS"
        value={`${precisionStrike.tokens}`}
        color={precisionStrike.tokens > 0 ? '#ff3333' : '#331111'}
        glow={precisionStrike.tokens > 0}
      />

      {/* Ultimate */}
      <HUDPanel label="ULTIMATE" value={ultVis.labelText} color={ultVis.fillColor}>
        <div className="meter" style={{ marginTop: 4 }}>
          <div
            className="meter__fill"
            style={{
              width: `${ultVis.progress * 100}%`,
              background: ultVis.fillColor,
              boxShadow: ultVis.ready ? `0 0 12px ${ultVis.fillColor}` : 'none',
            }}
          />
        </div>
      </HUDPanel>

      {/* Slipstream */}
      {slipstream.totalPlayers > 1 && (
        <HUDPanel
          label="SLIPSTREAM"
          value={slipVis.indicator}
          subValue={`P${slipVis.position}/${slipVis.totalPlayers}`}
          color={slipVis.color}
        />
      )}

      {/* Hidden Pocket */}
      <HUDPanel
        label="POCKET"
        value={pocketVis.hasDie ? `🎲 ${pocketVis.dieValue}` : '—'}
        subValue={pocketVis.tooltipText}
        color={pocketVis.glowing ? '#ff00ff' : '#444'}
        glow={pocketVis.glowing}
      />

      {/* Territory */}
      <HUDPanel
        label="TERRITORY"
        value={`${territory.territories.filter(t => t.ownerId !== null).length}/6`}
        subValue={`+${Math.round((territory.playerBonusMultiplier - 1) * 100)}%`}
        color={territory.territories.some(t => t.domainActive) ? '#00ffcc' : '#00aa88'}
      />

      {/* Heartbeat Warning */}
      {heartbeat.active && (
        <HUDPanel
          label="⚠ HEARTBEAT"
          value="ACTIVE"
          color="#ff3333"
          glow
          className={heartbeat.active ? 'animate-pulse' : ''}
        />
      )}

      {/* Active Rule Shard */}
      {ruleVis && (
        <HUDPanel
          label="RULE SHARD"
          value={ruleVis.ruleName}
          subValue={`${Math.ceil(ruleVis.timeRemainingMs / 1000)}s`}
          color={ruleVis.color}
          glow={ruleVis.pulsing}
          className={ruleVis.pulsing ? 'animate-pulse' : ''}
        />
      )}
    </div>
  );
};

// ── Sub-component ─────────────────────────────────────────────────────────────

interface HUDPanelProps {
  label: string;
  value: string;
  subValue?: string;
  color: string;
  glow?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const HUDPanel: React.FC<HUDPanelProps> = ({
  label,
  value,
  subValue,
  color,
  glow = false,
  className = '',
  children,
}) => (
  <div
    className={`glass-panel ${className}`}
    style={{
      padding: '8px 12px',
      borderColor: glow ? `${color}40` : undefined,
      boxShadow: glow ? `0 0 16px ${color}20` : undefined,
    }}
  >
    <div className="hud-label">{label}</div>
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '14px',
        fontWeight: 700,
        color,
        marginTop: 2,
      }}
    >
      {value}
    </div>
    {subValue && (
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'rgba(224, 224, 232, 0.4)',
        marginTop: 2,
      }}>
        {subValue}
      </div>
    )}
    {children}
  </div>
);
