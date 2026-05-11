// ─── FileDropZone ───────────────────────────────────────────────────────────
// Drag-and-drop + click-to-select audio file ingestion.

import { useCallback, useRef, useState } from 'react';

interface FileDropZoneProps {
  onFile: (file: File) => void;
  isLoading: boolean;
  progress: number;
  fileName?: string;
}

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac'];
const ACCEPTED_EXT_RE = /\.(mp3|wav|ogg|flac|aac)$/i;

function isAcceptedAudioFile(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT_RE.test(file.name);
}

export function FileDropZone({ onFile, isLoading, progress, fileName }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isAcceptedAudioFile(file)) {
      onFile(file);
    }
  }, [onFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isAcceptedAudioFile(file)) onFile(file);
  }, [onFile]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload audio file"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        position: 'relative',
        border: `2px dashed ${isDragging ? '#7c3aed' : '#333'}`,
        borderRadius: 12,
        padding: '40px 24px',
        textAlign: 'center',
        cursor: 'pointer',
        background: isDragging ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255,255,255,0.02)',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {isLoading ? (
        <>
          <div style={{ fontSize: 14, color: '#a0a0b0', marginBottom: 8 }}>
            Decoding {fileName}...
          </div>
          <div style={{
            width: '100%',
            height: 4,
            background: '#1a1a2e',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
              borderRadius: 2,
              transition: 'width 0.15s ease',
            }} />
          </div>
        </>
      ) : fileName ? (
        <div style={{ fontSize: 14, color: '#a0a0b0' }}>
          <span style={{ color: '#7c3aed' }}>✓</span> {fileName}
          <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
            Drop or click to load a different file
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎵</div>
          <div style={{ fontSize: 14, color: '#a0a0b0' }}>
            Drop an audio file here or <span style={{ color: '#7c3aed', textDecoration: 'underline' }}>browse</span>
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: '#555' }}>
            MP3, WAV, OGG, FLAC, AAC
          </div>
        </>
      )}
    </div>
  );
}
