import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMusicEngine } from '../music/useMusicEngine';

const MusicEngine: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { state, loadFile, play, pause, stop, seek, setVolume } = useMusicEngine();

  const canPlay = Boolean(state.analysis) && state.status !== 'decoding' && state.status !== 'analyzing';
  const isBusy = state.status === 'decoding' || state.status === 'analyzing';
  const isPlaying = state.status === 'playing';

  const fileDetail = useMemo(() => {
    if (!state.analysis) return [];
    return [
      ['BPM', state.analysis.bpm > 0 ? `${state.analysis.bpm}` : 'unresolved'],
      ['Duration', formatTime(state.analysis.duration)],
      ['Sample Rate', `${state.analysis.sampleRate.toLocaleString()} Hz`],
      ['Peak', state.analysis.peakAmplitude.toFixed(3)],
      ['RMS', state.analysis.rms.toFixed(3)],
      ['Centroid', `${state.analysis.spectralCentroid.toLocaleString()} Hz`],
    ];
  }, [state.analysis]);

  const handleFile = useCallback((file?: File) => {
    if (!file) return;
    loadFile(file);
  }, [loadFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    handleFile(event.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <div style={{ padding: '32px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#22D3EE', fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
            Music Engine
          </h1>
          <p style={{ color: '#64748B', margin: '8px 0 0' }}>
            Browser-native audio intelligence for tempo, energy, waveform, and spectral structure.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 20, alignItems: 'start' }}>
          <section style={panelStyle}>
            <div
              onDrop={handleDrop}
              onDragOver={event => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: dragActive ? '1px solid #22D3EE' : '1px dashed #334155',
                background: dragActive ? 'rgba(34,211,238,0.10)' : '#0A0E1A',
                borderRadius: 8,
                padding: 24,
                cursor: 'pointer',
                minHeight: 170,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                onChange={event => {
                  handleFile(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
                style={{ display: 'none' }}
              />
              <span style={{ color: '#94A3B8', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', marginBottom: 10 }}>
                PHASE 1 AUDIO INGEST
              </span>
              <strong style={{ color: '#E2E8F0', fontSize: 20, marginBottom: 8 }}>
                {state.fileName ?? 'Drop an audio file'}
              </strong>
              <span style={{ color: '#64748B', fontSize: 13 }}>
                MP3, WAV, M4A, AAC, OGG, and browser-supported audio formats are decoded locally.
              </span>
              {isBusy && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ height: 6, background: '#020617', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.round(state.progress * 100)}%`,
                        height: '100%',
                        background: '#22D3EE',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                  <div style={{ color: '#22D3EE', fontSize: 11, marginTop: 8, fontFamily: 'JetBrains Mono, monospace' }}>
                    {state.stage.toUpperCase()} · {Math.round(state.progress * 100)}%
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={isPlaying ? pause : play}
                disabled={!canPlay}
                style={buttonStyle(canPlay)}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button onClick={stop} disabled={!canPlay} style={secondaryButtonStyle(canPlay)}>
                Stop
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 12 }}>
                Volume
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.volume}
                  onChange={event => setVolume(Number(event.target.value))}
                  style={{ width: 110 }}
                />
              </label>
            </div>

            <div style={{ marginTop: 14, color: '#64748B', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              {formatTime(state.currentTime)} / {formatTime(state.duration)}
            </div>

            {state.error && (
              <div style={{ marginTop: 16, color: '#FCA5A5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: 12, fontSize: 13 }}>
                {state.error}
              </div>
            )}
          </section>

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Waveform</h2>
            <Waveform
              data={state.analysis?.waveform ?? []}
              currentTime={state.currentTime}
              duration={state.duration}
              onSeek={seek}
            />

            <h2 style={{ ...sectionTitleStyle, marginTop: 24 }}>Spectrum</h2>
            <Spectrum data={state.analysis?.spectrum ?? []} active={isPlaying} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 24 }}>
              {fileDetail.map(([label, value]) => (
                <div key={label} style={{ background: '#0A0E1A', border: '1px solid #1E293B', borderRadius: 6, padding: 12 }}>
                  <div style={{ color: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{label}</div>
                  <div style={{ color: '#E2E8F0', fontSize: 18, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const Waveform: React.FC<{
  data: number[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}> = ({ data, currentTime, duration, onSeek }) => {
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        onSeek(ratio * duration);
      }}
      style={{
        height: 150,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: '#0A0E1A',
        border: '1px solid #1E293B',
        borderRadius: 8,
        padding: '12px 10px',
        cursor: data.length > 0 ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
    >
      {(data.length > 0 ? data : Array.from({ length: 80 }, () => 0.08)).map((value, index, source) => {
        const active = index / source.length <= progress;
        return (
          <span
            key={index}
            style={{
              flex: '1 1 0',
              height: `${Math.max(5, value * 116)}px`,
              background: active ? '#22D3EE' : '#334155',
              borderRadius: 999,
              opacity: data.length > 0 ? 1 : 0.35,
            }}
          />
        );
      })}
    </div>
  );
};

const Spectrum: React.FC<{ data: number[]; active: boolean }> = ({ data, active }) => {
  const bars = data.length > 0 ? data : Array.from({ length: 48 }, (_, index) => 0.08 + (index % 8) * 0.035);

  return (
    <div
      style={{
        height: 170,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        background: '#0A0E1A',
        border: '1px solid #1E293B',
        borderRadius: 8,
        padding: 12,
      }}
    >
      {bars.map((value, index) => (
        <span
          key={index}
          style={{
            flex: '1 1 0',
            height: `${Math.max(6, value * 140)}px`,
            background: active ? '#10B981' : '#475569',
            borderRadius: '6px 6px 2px 2px',
            opacity: data.length > 0 ? 0.95 : 0.3,
            transition: 'height 0.2s ease',
          }}
        />
      ))}
    </div>
  );
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

const panelStyle: React.CSSProperties = {
  background: '#12172B',
  border: '1px solid #1E293B',
  borderRadius: 8,
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: 13,
  fontFamily: 'JetBrains Mono, monospace',
  margin: '0 0 12px',
};

function buttonStyle(enabled: boolean): React.CSSProperties {
  return {
    background: enabled ? '#22D3EE' : '#1E293B',
    color: enabled ? '#0A0E1A' : '#64748B',
    border: 'none',
    borderRadius: 6,
    padding: '9px 18px',
    cursor: enabled ? 'pointer' : 'default',
    fontWeight: 700,
  };
}

function secondaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    background: 'rgba(148,163,184,0.12)',
    color: enabled ? '#CBD5E1' : '#64748B',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '9px 14px',
    cursor: enabled ? 'pointer' : 'default',
    fontWeight: 600,
  };
}

export default MusicEngine;
