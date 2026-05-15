// ─────────────────────────────────────────────────────
// Organic Vegas — 2-Player WebSocket Multiplayer Hook
// Connects to dream/apps/backend/src/gameRoom.ts via WebSocket.
// Symbolic replication: only seeds/states transmitted, not full game frames.
// Plan for 4-player: see FOUR_PLAYER_PLAN.md in shared/.
// ─────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';

export type LobbyPhase =
  | 'IDLE'
  | 'CONNECTING'
  | 'WAITING'     // in room, waiting for 2nd player
  | 'READY'       // both players present, game can start
  | 'IN_GAME'
  | 'DISCONNECTED'
  | 'ERROR';

export interface RemotePlayer {
  id: string;
  name: string;
  banked: number;
  energy: number;
}

export interface MultiplayerState {
  phase: LobbyPhase;
  roomCode: string | null;
  localPlayerId: string;
  players: RemotePlayer[];
  activePlayerId: string | null;
  lastError: string | null;
  // Energy broadcasted by server
  localEnergy: number;
}

interface UseOrganicMultiplayerOptions {
  playerName: string;
  wsUrl?: string;
}

const DEFAULT_WS_URL = `ws://${window.location.hostname}:3001`;

export function useOrganicMultiplayer({ playerName, wsUrl = DEFAULT_WS_URL }: UseOrganicMultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<MultiplayerState>({
    phase: 'IDLE',
    roomCode: null,
    localPlayerId: `p-${Date.now()}`,
    players: [],
    activePlayerId: null,
    lastError: null,
    localEnergy: 150,
  });

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback((roomCode: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setState(s => ({ ...s, phase: 'CONNECTING', roomCode, lastError: null }));

    const ws = new WebSocket(
      `${wsUrl}?room=${encodeURIComponent(roomCode)}&playerId=${state.localPlayerId}&playerName=${encodeURIComponent(playerName)}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setState(s => ({ ...s, phase: 'WAITING' }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      setState(s => ({ ...s, phase: 'ERROR', lastError: 'WebSocket connection failed' }));
    };

    ws.onclose = () => {
      setState(s => ({
        ...s,
        phase: s.phase === 'IN_GAME' ? 'DISCONNECTED' : 'IDLE',
      }));
    };
  }, [wsUrl, playerName, state.localPlayerId]);

  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    switch (msg['type']) {
      case 'ROOM_STATE': {
        const players = (msg['players'] as RemotePlayer[] | undefined) ?? [];
        setState(s => ({
          ...s,
          players,
          activePlayerId: msg['activePlayerId'] as string | null,
          phase: players.length >= 2 ? 'READY' : 'WAITING',
        }));
        break;
      }
      case 'PLAYER_JOINED': {
        setState(s => {
          const exists = s.players.some(p => p.id === msg['playerId']);
          if (exists) return s;
          const newPlayer: RemotePlayer = {
            id: msg['playerId'] as string,
            name: msg['playerName'] as string,
            banked: 0,
            energy: 150,
          };
          const updated = [...s.players, newPlayer];
          return { ...s, players: updated, phase: updated.length >= 2 ? 'READY' : 'WAITING' };
        });
        break;
      }
      case 'PLAYER_LEFT': {
        setState(s => ({
          ...s,
          players: s.players.filter(p => p.id !== msg['playerId']),
          phase: 'WAITING',
        }));
        break;
      }
      case 'GAME_STARTED': {
        setState(s => ({ ...s, phase: 'IN_GAME', activePlayerId: msg['activePlayerId'] as string }));
        break;
      }
      case 'TURN_RESULT': {
        setState(s => ({
          ...s,
          activePlayerId: msg['nextPlayerId'] as string,
          players: s.players.map(p =>
            p.id === msg['playerId']
              ? { ...p, banked: (msg['banked'] as number) ?? p.banked }
              : p,
          ),
        }));
        break;
      }
      case 'ENERGY_UPDATE': {
        if (msg['playerId'] === state.localPlayerId) {
          setState(s => ({ ...s, localEnergy: msg['energy'] as number }));
        }
        break;
      }
      case 'ERROR': {
        setState(s => ({ ...s, lastError: msg['message'] as string }));
        break;
      }
    }
  }, [state.localPlayerId]);

  // ── Actions ────────────────────────────────────────────────────────────

  const createRoom = useCallback(() => {
    // Room code: 4-char alphanumeric from seeded char selection (no Math.random)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = crypto.getRandomValues(new Uint8Array(4));
    const code = Array.from(buf, b => chars[b % chars.length]).join('');
    connect(code);
  }, [connect]);

  const joinRoom = useCallback((code: string) => {
    connect(code.toUpperCase().trim());
  }, [connect]);

  const startGame = useCallback(() => {
    send({ type: 'START_GAME' });
  }, [send]);

  const sendChain = useCallback((chain: string[]) => {
    send({ type: 'COMMIT_CHAIN', chain });
  }, [send]);

  const sendBank = useCallback(() => {
    send({ type: 'BANK' });
  }, [send]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    setState(s => ({ ...s, phase: 'IDLE', roomCode: null, players: [] }));
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { wsRef.current?.close(); }, []);

  return {
    state,
    createRoom,
    joinRoom,
    startGame,
    sendChain,
    sendBank,
    disconnect,
    isMyTurn: state.activePlayerId === state.localPlayerId,
  };
}
