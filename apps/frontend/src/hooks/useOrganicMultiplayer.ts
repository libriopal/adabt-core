// ─────────────────────────────────────────────────────
// Organic Vegas — 2-Player WebSocket Multiplayer Hook
// Connects to dream/apps/backend/src/gameRoom.ts via WebSocket.
// Symbolic replication: only seeds/states transmitted, not full game frames.
// Plan for 4-player: see shared/FOUR_PLAYER_PLAN.md (next sprint).
//
// Message protocol matches gameRoom.ts broadcast types exactly:
//   ROOM_STATE, PLAYER_JOINED, PLAYER_LEFT, GAME_STARTED,
//   TURN_CHANGE, CHAIN_RESULT, BOARD_UPDATE, ENERGY_UPDATE,
//   ENERGY_ZERO, SESSION_END, MILESTONE_PAYOUT, ERROR
// ─────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Cell } from '@match3d/farkle-shared';

export type LobbyPhase =
  | 'IDLE'
  | 'CONNECTING'
  | 'WAITING'      // in room, waiting for 2nd player
  | 'READY'        // both players present, game can start
  | 'IN_GAME'
  | 'SESSION_END'  // server confirmed game over
  | 'DISCONNECTED'
  | 'ERROR';

export interface RemotePlayer {
  id: string;
  name: string;
  banked: number;
  energy: number;
  role?: string;
}

export interface SessionResult {
  winnerId: string | null;
  payout: number;
  serverSeed: string;
  committedHash: string;
}

export interface ChainResult {
  result: 'SCORE' | 'FARKLE';
  unbanked: number;
  banked: number;
}

export interface MultiplayerState {
  phase: LobbyPhase;
  roomCode: string | null;
  localPlayerId: string;
  players: RemotePlayer[];
  activePlayerId: string | null;
  lastError: string | null;
  localEnergy: number;
  gameMode: string | null;
  grid: Cell[][] | null;
  lastChainResult: ChainResult | null;
  sessionResult: SessionResult | null;
}

interface UseOrganicMultiplayerOptions {
  playerName: string;
  wsUrl?: string;
}

const DEFAULT_WS_URL = `ws://${window.location.hostname}:3001`;

export function useOrganicMultiplayer({
  playerName,
  wsUrl = DEFAULT_WS_URL,
}: UseOrganicMultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const localPlayerIdRef = useRef<string>(`p-${Date.now()}`);

  const [state, setState] = useState<MultiplayerState>({
    phase: 'IDLE',
    roomCode: null,
    localPlayerId: localPlayerIdRef.current,
    players: [],
    activePlayerId: null,
    lastError: null,
    localEnergy: 150,
    gameMode: null,
    grid: null,
    lastChainResult: null,
    sessionResult: null,
  });

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // handleMessage is not a useCallback because it must always read the latest
  // localPlayerId without creating a dependency cycle.
  const handleMessage = (msg: Record<string, unknown>) => {
    const localId = localPlayerIdRef.current;

    switch (msg['type']) {
      case 'ROOM_STATE': {
        // Full state broadcast sent on join
        const publicState = msg['state'] as {
          players?: RemotePlayer[];
          activePlayerId?: string | null;
          grid?: Cell[][] | null;
        } | undefined;
        const players = publicState?.players ?? [];
        setState(s => ({
          ...s,
          players,
          activePlayerId: publicState?.activePlayerId ?? null,
          grid: publicState?.grid ?? null,
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
          phase: s.phase === 'IN_GAME' ? 'WAITING' : s.phase,
        }));
        break;
      }

      case 'GAME_STARTED': {
        // roles: Record<playerId, roleName>
        const roles = (msg['roles'] as Record<string, string> | undefined) ?? {};
        setState(s => ({
          ...s,
          phase: 'IN_GAME',
          gameMode: (msg['gameMode'] as string) ?? null,
          players: s.players.map(p => ({ ...p, role: roles[p.id] })),
        }));
        break;
      }

      case 'TURN_CHANGE': {
        setState(s => ({
          ...s,
          activePlayerId: (msg['activePlayerId'] as string) ?? null,
        }));
        break;
      }

      case 'CHAIN_RESULT': {
        const result: ChainResult = {
          result: (msg['result'] as 'SCORE' | 'FARKLE') ?? 'FARKLE',
          unbanked: (msg['unbanked'] as number) ?? 0,
          banked: (msg['banked'] as number) ?? 0,
        };
        setState(s => ({
          ...s,
          lastChainResult: result,
          // Mirror banked score onto the active player's profile
          players: s.players.map(p =>
            p.id === s.activePlayerId
              ? { ...p, banked: result.banked }
              : p,
          ),
        }));
        break;
      }

      case 'BOARD_UPDATE': {
        setState(s => ({ ...s, grid: (msg['grid'] as Cell[][] | null) ?? s.grid }));
        break;
      }

      case 'ENERGY_UPDATE': {
        const pid = msg['playerId'] as string;
        const energy = (msg['energy'] as number) ?? 0;
        if (pid === localId) {
          setState(s => ({ ...s, localEnergy: energy }));
        }
        setState(s => ({
          ...s,
          players: s.players.map(p => p.id === pid ? { ...p, energy } : p),
        }));
        break;
      }

      case 'ENERGY_ZERO': {
        const pid = msg['playerId'] as string;
        if (pid === localId) setState(s => ({ ...s, localEnergy: 0 }));
        setState(s => ({
          ...s,
          players: s.players.map(p => p.id === pid ? { ...p, energy: 0 } : p),
        }));
        break;
      }

      case 'SESSION_END': {
        const result: SessionResult = {
          winnerId: (msg['winnerId'] as string | null) ?? null,
          payout: (msg['payout'] as number) ?? 0,
          serverSeed: (msg['serverSeed'] as string) ?? '',
          committedHash: (msg['committedHash'] as string) ?? '',
        };
        setState(s => ({ ...s, phase: 'SESSION_END', sessionResult: result }));
        break;
      }

      case 'ERROR': {
        setState(s => ({ ...s, lastError: (msg['message'] as string) ?? 'Unknown error' }));
        break;
      }

      // Non-critical messages — no state mutation needed for now:
      // MILESTONE_PAYOUT, RALLY_DECISION_START, RALLY_VOTE_UPDATE,
      // RALLY_DECISION, DISRUPTION_INCOMING
    }
  };

  const connect = useCallback((roomCode: string) => {
    wsRef.current?.close();
    setState(s => ({
      ...s,
      phase: 'CONNECTING',
      roomCode,
      lastError: null,
      sessionResult: null,
      lastChainResult: null,
    }));

    const ws = new WebSocket(
      `${wsUrl}/ws?room=${encodeURIComponent(roomCode)}` +
      `&playerId=${localPlayerIdRef.current}` +
      `&playerName=${encodeURIComponent(playerName)}`,
    );
    wsRef.current = ws;

    ws.onopen = () => setState(s => ({ ...s, phase: 'WAITING' }));

    ws.onmessage = (ev) => {
      try {
        handleMessage(JSON.parse(ev.data as string) as Record<string, unknown>);
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
        phase: s.phase === 'IN_GAME' ? 'DISCONNECTED' : s.phase === 'SESSION_END' ? 'SESSION_END' : 'IDLE',
      }));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl, playerName]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const createRoom = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = crypto.getRandomValues(new Uint8Array(4));
    const code = Array.from(buf, b => chars[b! % chars.length]).join('');
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
    setState(s => ({ ...s, phase: 'IDLE', roomCode: null, players: [], grid: null }));
  }, []);

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
    isWinner: state.sessionResult?.winnerId === state.localPlayerId,
  };
}
