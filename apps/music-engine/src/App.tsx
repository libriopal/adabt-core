// ─── Music Intelligence Engine ──────────────────────────────────────────────
// Phase 1: Audio ingestion, decode, playback, waveform, spectrum visualization.

import { useAudioEngine } from './hooks/useAudioEngine';
import { FileDropZone } from './components/FileDropZone';
import { WaveformDisplay } from './components/WaveformDisplay';
import { SpectrumVisualizer } from './components/SpectrumVisualizer';
import { TransportControls } from './components/TransportControls';
import { TelemetryPanel } from './components/TelemetryPanel';

export default function App() {
  const { state, loadFile, play, pause, stop, seek, setVolume } = useAudioEngine();
  const { playback, file, decodeProgress, waveformPreview, vfxSnapshot, telemetry } = state;

  const isLoading = playback.status === 'loading';
  const hasAudio = playback.status === 'paused' || playback.status === 'playing';

  return (
    <div style={{
      maxWidth: 900,
      margin: '0 auto',
      padding: '40px 24px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #7c3aed, #a78bfa, #06b6d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: -0.5,
        }}>
          Music Intelligence Engine
        </h1>
        <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
          Phase 1 — Audio Ingestion & Visualization
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

      {/* Transport */}
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

      {/* File Info */}
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
              border: '1px solid #1a1a2e',
              borderRadius: 8,
              padding: '8px 12px',
            }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
              </div>
              <div style={{ fontSize: 13, color: '#a0a0b0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Telemetry */}
      <TelemetryPanel events={telemetry} />

      {/* Footer */}
      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 11, color: '#333', padding: 12 }}>
        AGROS Music Intelligence Engine v0.1.0 — Workers: decode ✓ | analysis ○ | orchestration ○
      </div>
    </div>
  );
}
