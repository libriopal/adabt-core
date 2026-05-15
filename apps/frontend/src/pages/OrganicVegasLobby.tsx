// ─────────────────────────────────────────────────────
// Organic Vegas — 2-Player Lobby
// Create or join a room before entering the 3D game.
// Room codes are crypto-random (no Math.random).
// ─────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganicMultiplayer } from '../hooks/useOrganicMultiplayer';
import { HARDWARE } from '../utils/hardwareTier';
import '../styles/organic-vegas.css';

export default function OrganicVegasLobby() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'CHOOSE' | 'CREATE' | 'JOIN' | 'SOLO'>('CHOOSE');

  const { state, createRoom, joinRoom, startGame, disconnect } =
    useOrganicMultiplayer({ playerName: playerName || 'WRAITH' });

  const handleCreate = useCallback(() => {
    if (!playerName.trim()) return;
    setMode('CREATE');
    createRoom();
  }, [playerName, createRoom]);

  const handleJoin = useCallback(() => {
    if (!playerName.trim() || !joinCode.trim()) return;
    setMode('JOIN');
    joinRoom(joinCode);
  }, [playerName, joinCode, joinRoom]);

  const handleStartSolo = useCallback(() => {
    navigate('/organic-vegas/game?mode=solo');
  }, [navigate]);

  const handleStartMultiplayer = useCallback(() => {
    startGame();
    navigate('/organic-vegas/game?mode=multi');
  }, [startGame, navigate]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setMode('CHOOSE');
  }, [disconnect]);

  const isConnecting = state.phase === 'CONNECTING';
  const isWaiting = state.phase === 'WAITING';
  const isReady = state.phase === 'READY';
  const hasError = state.phase === 'ERROR';

  return (
    <div className="ov-lobby">
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div className="ov-title" style={{ fontSize: 32, marginBottom: 4 }}>
          ORGANIC VEGAS
        </div>
        <div style={{ fontSize: 11, color: 'var(--ov-bone-shadow)', letterSpacing: '0.15em' }}>
          BIO-ARCHITECTURAL FARKLE · {HARDWARE.quality} MODE
        </div>
      </div>

      <div className="ov-lobby__card">

        {/* ── Mode selection ── */}
        {mode === 'CHOOSE' && (
          <>
            <div className="ov-lobby__title">ENTER THE VAULT</div>
            <div className="ov-lobby__subtitle">WRAITH IDENTITY</div>

            <div className="ov-lobby__row">
              <label className="ov-label">YOUR NAME</label>
              <input
                className="ov-input"
                placeholder="WRAITH"
                value={playerName}
                onChange={e => setPlayerName(e.target.value.toUpperCase().slice(0, 12))}
                maxLength={12}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button
                className="ov-btn"
                onClick={handleCreate}
                disabled={!playerName.trim()}
              >
                CREATE ROOM (2-PLAYER)
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="ov-input"
                  placeholder="ROOM CODE"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                  maxLength={4}
                  style={{ flex: 1 }}
                />
                <button
                  className="ov-btn"
                  onClick={handleJoin}
                  disabled={!playerName.trim() || joinCode.length < 4}
                  style={{ padding: '10px 16px', flexShrink: 0 }}
                >
                  JOIN
                </button>
              </div>

              <button
                className="ov-btn ov-btn--cyan"
                onClick={handleStartSolo}
                disabled={false}
              >
                SOLO RUN (LOCAL)
              </button>
            </div>
          </>
        )}

        {/* ── Connecting / Waiting ── */}
        {(mode === 'CREATE' || mode === 'JOIN') && !hasError && (
          <>
            <div className="ov-lobby__title">
              {isConnecting ? 'OPENING PORTAL…' : isWaiting ? 'AWAITING SECOND SOUL' : 'VAULT SEALED'}
            </div>
            {state.roomCode && (
              <div style={{ textAlign: 'center', margin: '12px 0' }}>
                <div className="ov-label">ROOM CODE</div>
                <div style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: 'var(--ov-gold-glow)',
                  textShadow: '0 0 20px var(--ov-gold)',
                  letterSpacing: '0.3em',
                  fontFamily: 'var(--ov-font-mono)',
                }}>
                  {state.roomCode}
                </div>
                <div className="ov-lobby__subtitle">Share this code with your opponent</div>
              </div>
            )}

            {/* Player slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[0, 1].map(i => {
                const p = state.players[i];
                return (
                  <div key={i} className="ov-player-slot">
                    <div className={`ov-player-slot__dot${p ? ' ov-player-slot__dot--ready' : ''}`} />
                    <span className="ov-player-slot__name">
                      {p ? p.name : `SLOT ${i + 1} — WAITING…`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="ov-lobby__status">
              {isWaiting && '⟳ Waiting for opponent to connect…'}
              {isReady && '✓ Both players connected — ready to start'}
              {isConnecting && 'Establishing connection…'}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                className="ov-btn"
                onClick={handleStartMultiplayer}
                disabled={!isReady}
                style={{ flex: 1 }}
              >
                START MATCH
              </button>
              <button
                className="ov-btn ov-btn--danger"
                onClick={handleDisconnect}
                style={{ padding: '10px 16px' }}
              >
                LEAVE
              </button>
            </div>
          </>
        )}

        {/* ── Error state ── */}
        {hasError && (
          <>
            <div className="ov-lobby__title" style={{ color: 'var(--ov-blood-red)' }}>
              CONNECTION SEVERED
            </div>
            <div className="ov-lobby__subtitle">{state.lastError}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="ov-btn" onClick={() => setMode('CHOOSE')} style={{ flex: 1 }}>
                RETRY
              </button>
              <button className="ov-btn ov-btn--cyan" onClick={handleStartSolo} style={{ flex: 1 }}>
                PLAY SOLO
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ fontSize: 9, color: 'var(--ov-bone-shadow)', letterSpacing: '0.1em' }}>
        4-PLAYER SUPPORT — NEXT SPRINT · TIER {HARDWARE.dspTier} HARDWARE DETECTED
      </div>
    </div>
  );
}
