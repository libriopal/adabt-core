// ─────────────────────────────────────────────────────
// DREAM-CORE — Vignette Overlay Component
// Full-screen overlay for Horror heartbeat dread effect.
// Intensity driven by heartbeat proximity-to-farkle.
// ─────────────────────────────────────────────────────

import React from 'react';
import { useDreamStore } from '../../../../../packages/dream-core/src/state/dreamStore';

export const VignetteOverlay: React.FC = () => {
  const heartbeat = useDreamStore(s => s.heartbeat);

  if (!heartbeat.active) return null;

  const intensity = heartbeat.vignetteIntensity;

  return (
    <div
      className="vignette-overlay vignette-overlay--active"
      style={{
        boxShadow: `inset 0 0 ${150 * intensity}px ${60 * intensity}px rgba(${
          heartbeat.flatlined ? '80, 0, 0' : '0, 0, 0'
        }, ${0.4 + intensity * 0.5})`,
      }}
    >
      {/* Red pulse border during flatline */}
      {heartbeat.flatlined && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: `3px solid rgba(255, 50, 50, ${0.3 + intensity * 0.4})`,
          borderRadius: 0,
          animation: 'pulse-glow 0.4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Heartbeat BPM indicator */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: `rgba(255, 50, 50, ${intensity})`,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
      }}>
        ♥ {heartbeat.bpm} BPM
      </div>
    </div>
  );
};
