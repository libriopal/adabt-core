// ─── Music Intelligence Engine ──────────────────────────────────────────────
// Unified tab within AGROS — audio ingestion, decode, playback, waveform,
// spectrum visualization, and DSP analysis.
// Merged from music-intelligence-engine standalone + apps/music-engine Phase 1+2.

import React from 'react';
import { useAudioEngine } from '../music/hooks/useAudioEngine';
import { FileDropZone } from '../music/components/FileDropZone';
import { WaveformDisplay } from '../music/components/WaveformDisplay';
import { SpectrumVisualizer } from '../music/components/SpectrumVisualizer';
import { TransportControls } from '../music/components/TransportControls';
import { TelemetryPanel } from '../music/components/TelemetryPanel';

const MusicEngine: React.FC = () => {
  const { state, loadFile, play, pause, stop, seek, setVolume } = useAudioEngine();
  const { playback, file, decodeProgress, waveformPreview, vfxSnapshot, telemetry } = state;

  const isLoading = playback.status === 'loading';
  const hasAudio = playback.status === 'paused' || playback.status === 'playing';

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
      padding: '32px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      minHeight: 'calc(100vh - 48px)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
          background: 'linear-gradient(135deg, #7c3aed, #a78bfa, #22D3EE)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: -0.5,
          margin: 0,
        }}>
          Music Intelligence Engine
        </h1>
        <p style={{
          fontSize: 12,
          color: '#64748B',
          marginTop: 6,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          Phase 1 — Audio Ingestion, Decode & Visualization
        </p>
      </div>

      {/* File Drop Zone */}
      <FileDropZone
        onFile={loadFile}
        isLoading={isLoading}
        progress={decodeProgress}
        fileName={file?.name}
      />

      {/* Waveform */}
      {waveformPreview && (
        <WaveformDisplay
          waveform={waveformPreview}
          currentTime={playback.currentTime}
          duration={playback.duration}
          isPlaying={playback.status === 'playing'}
          onSeek={seek}
        />
      )}

      {/* Transport Controls */}
      {hasAudio && (
        <TransportControls
          playback={playback}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onVolumeChange={setVolume}
        />
      )}

      {/* Spectrum Visualizer */}
      {hasAudio && (
        <SpectrumVisualizer
          snapshot={vfxSnapshot}
          isPlaying={playback.status === 'playing'}
        />
      )}

      {/* File Info Grid */}
      {file && hasAudio && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 12,
        }}>
          {[
            { label: 'File', value: file.name },
            { label: 'Size', value: `${(file.size / (1024 * 1024)).toFixed(1)} MB` },
            { label: 'Sample Rate', value: file.sampleRate ? `${file.sampleRate} Hz` : '—' },
            { label: 'Duration', value: file.duration ? `${file.duration.toFixed(1)}s` : '—' },
            { label: 'Channels', value: file.channels?.toString() ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid #1E293B',
              borderRadius: 8,
              padding: '8px 12px',
            }}>
              <div style={{
                fontSize: 10,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {label}
              </div>
              <div style={{
                fontSize: 13,
                color: '#94A3B8',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Telemetry */}
      <TelemetryPanel events={telemetry} />

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        textAlign: 'center',
        fontSize: 11,
        color: '#334155',
        padding: 12,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        AGROS Music Intelligence Engine v0.1.0 — Workers: decode ✓ | analysis ○ | orchestration ○
      </div>
    </div>
  );
};

export default MusicEngine;
