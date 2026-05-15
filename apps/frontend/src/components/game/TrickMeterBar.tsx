// ─────────────────────────────────────────────────────
// DREAM-CORE — Trick Meter Bar Component
// Fills with consecutive banks. COLD→WARM→HOT→FRENZY.
// Visual juice intensifies with each level.
// ─────────────────────────────────────────────────────

import React from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';
import { getTrickMeterVisuals } from '../../../../../packages/dream-core/src/genres/sports';

interface TrickMeterBarProps {
  className?: string;
}

export const TrickMeterBar: React.FC<TrickMeterBarProps> = ({ className = '' }) => {
  const trickMeter = useDreamStore(s => s.trickMeter);
  const vis = getTrickMeterVisuals(trickMeter);

  return (
    <div
      className={`glass-panel ${className}`}
      style={{
        padding: '8px 12px',
        animation: vis.shakeIntensity > 0 ? 'shake 0.15s ease-in-out infinite' : 'none',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }}>
        <span className="hud-label">TRICK METER</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          fontWeight: 700,
          color: vis.fillColor,
          textShadow: vis.glowIntensity > 0.5 ? `0 0 8px ${vis.fillColor}` : 'none',
        }}>
          {vis.labelText}
        </span>
      </div>

      <div className="meter" style={{ height: '8px' }}>
        <div
          className="meter__fill"
          style={{
            width: `${vis.progress * 100}%`,
            background: `linear-gradient(90deg, ${vis.backgroundColor}, ${vis.fillColor})`,
            boxShadow: `0 0 ${vis.glowIntensity * 12}px ${vis.fillColor}`,
          }}
        />

        {/* Threshold markers */}
        {[3, 5, 8].map(threshold => (
          <div
            key={threshold}
            style={{
              position: 'absolute',
              left: `${(threshold / 8) * 100}%`,
              top: 0,
              width: '1px',
              height: '100%',
              background: 'rgba(255, 255, 255, 0.2)',
            }}
          />
        ))}
      </div>

      {/* Streak dots */}
      <div style={{
        display: 'flex',
        gap: '3px',
        marginTop: '4px',
        justifyContent: 'center',
      }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: i < vis.streak
                ? vis.fillColor
                : 'rgba(255, 255, 255, 0.1)',
              boxShadow: i < vis.streak && vis.glowIntensity > 0.3
                ? `0 0 4px ${vis.fillColor}`
                : 'none',
              transition: 'all 0.2s ease',
            }}
          />
        ))}
      </div>

      {/* Particle emitter placeholder */}
      {vis.particleEmitting && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          borderRadius: '8px',
        }}>
          {/* CSS particle effect — shimmer overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at ${50 + particleOffset(vis.streak, 0)}% ${50 + particleOffset(vis.streak, 1)}%, ${vis.fillColor}15 0%, transparent 70%)`,
            animation: 'pulse-glow 0.8s ease-in-out infinite',
          }} />
        </div>
      )}
    </div>
  );
};

function particleOffset(streak: number, salt: number): number {
  const x = Math.sin((streak + 1) * (salt + 3) * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 20;
}
