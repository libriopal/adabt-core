// ─── TransportControls ──────────────────────────────────────────────────────
// Play/pause/stop + time display + volume slider.

import type { PlaybackState } from '../types/audio';

interface TransportControlsProps {
  playback: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TransportControls({
  playback,
  onPlay,
  onPause,
  onStop,
  onVolumeChange,
}: TransportControlsProps) {
  const isPlayable = playback.status === 'paused' || playback.status === 'playing';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
    }}>
      {/* Play/Pause */}
      <button
        aria-label={playback.status === 'playing' ? 'Pause playback' : 'Start playback'}
        onClick={playback.status === 'playing' ? onPause : onPlay}
        disabled={!isPlayable}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          background: isPlayable ? '#7c3aed' : '#333',
          color: '#fff',
          fontSize: 18,
          cursor: isPlayable ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        {playback.status === 'playing' ? '⏸' : '▶'}
      </button>

      {/* Stop */}
      <button
        aria-label="Stop playback"
        onClick={onStop}
        disabled={!isPlayable}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1px solid #333',
          background: 'transparent',
          color: isPlayable ? '#a0a0b0' : '#444',
          fontSize: 14,
          cursor: isPlayable ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ⏹
      </button>

      {/* Time Display */}
      <div style={{
        fontFamily: 'monospace',
        fontSize: 14,
        color: '#a0a0b0',
        minWidth: 100,
      }}>
        {formatTime(playback.currentTime)} / {formatTime(playback.duration)}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, color: '#666' }}>🔊</span>
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={playback.volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          style={{
            width: 80,
            accentColor: '#7c3aed',
          }}
        />
      </div>

      {/* Status Indicator */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: playback.status === 'playing' ? '#22c55e'
          : playback.status === 'loading' ? '#eab308'
          : playback.status === 'error' ? '#ef4444'
          : '#555',
        transition: 'background 0.3s',
      }} />
    </div>
  );
}
