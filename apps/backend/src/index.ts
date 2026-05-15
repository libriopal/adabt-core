import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { router } from './api/routes';
import { initDatabase } from './storage/db';
import { GameRoom } from './gameRoom';

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// SharedArrayBuffer requires COOP/COEP on every response (DSP AudioWorklet)
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.use(helmet({
  contentSecurityPolicy: IS_PRODUCTION ? false : undefined,
}));
app.use(cors({
  origin: IS_PRODUCTION
    ? true
    : (process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173']),
}));
app.use(express.json({ limit: '10mb' }));

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api', router);

// ── Serve frontend in production ────────────────────────────────────────────
if (IS_PRODUCTION) {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── Error handler ───────────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, _next: any) => {
  // Use crypto for debug IDs so we don't use Math.random() in production paths
  const buf = new Uint8Array(2);
  crypto.getRandomValues(buf);
  const debugId = `API-${buf[0]!.toString(16).padStart(2,'0').toUpperCase()}${buf[1]!.toString(16).padStart(2,'0').toUpperCase()}`;
  console.error(`[${debugId}] Unhandled API error on ${req.method} ${req.path}:`, err);
  res.status(500).json({
    success: false,
    debugId,
    error: IS_PRODUCTION ? 'Internal error' : err.message,
  });
});

// ── Database ────────────────────────────────────────────────────────────────
initDatabase();

// ── Workers (require Redis — gracefully skip if unavailable) ────────────────
if (process.env.ENABLE_WORKERS !== 'false') {
  import('./workers')
    .then(({ startWorkers }) => startWorkers())
    .catch((err) => {
      console.warn('[Worker] Failed to start background workers (Redis unavailable?):', err.message);
      console.warn('[Worker] The API will still work — background jobs are disabled.');
    });
}

// ── HTTP + WebSocket server ─────────────────────────────────────────────────
const server = http.createServer(app);

// ── Organic Vegas room registry ─────────────────────────────────────────────
// Supports 2-player rooms today. Plan for 4-player: extend maxPlayers to 4,
// shard the turn-order map, and add team/free-for-all settings flags.
// See shared/FOUR_PLAYER_PLAN.md for the full next-sprint roadmap.
const rooms = new Map<string, GameRoom>();
const MAX_PLAYERS_PER_ROOM = 2;       // day-one cap; 4-player next sprint

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const roomCode  = url.searchParams.get('room')?.toUpperCase().trim() ?? '';
  const playerId  = url.searchParams.get('playerId') ?? `anon-${Date.now()}`;
  const playerName = decodeURIComponent(url.searchParams.get('playerName') ?? 'WRAITH');

  if (!roomCode) {
    ws.close(1008, 'Missing room code');
    return;
  }

  // Create room if it doesn't exist
  if (!rooms.has(roomCode)) {
    const settings = {
      mode: 'VS_FREE',
      playerCount: MAX_PLAYERS_PER_ROOM,
      turnTimerSeconds: 15 as const,
      blockerDensity: 'MEDIUM',
      threeOnesScore: 1000,
      singleOneScore: 100,
      currencyMode: 'FD',
      stakeAmount: 0,
      rainbowRedReward: 100,
      rainbowBlueReward: 50,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rooms.set(roomCode, new GameRoom(settings as any));
  }

  const room = rooms.get(roomCode)!;

  // Enforce 2-player cap
  if ((room as any).players?.size >= MAX_PLAYERS_PER_ROOM) {
    ws.close(1008, 'Room full (2 players max — 4-player support coming next sprint)');
    return;
  }

  room.addPlayer(ws, playerId, playerName);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as { type: string; [k: string]: unknown };
      if (msg.type === 'START_GAME') {
        room.handleMessage(playerId, { type: 'START_GAME' });
      } else {
        room.handleMessage(playerId, msg);
      }
    } catch {
      // ignore malformed frames
    }
  });

  ws.on('close', () => {
    room.removePlayer(playerId);
    // Clean up empty rooms
    if ((room as any).players?.size === 0) {
      rooms.delete(roomCode);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Room ${roomCode} player ${playerId} error:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Organic Vegas Backend running on port ${PORT}`);
  console.log(`[Server] Mode: ${IS_PRODUCTION ? 'production' : 'development'}`);
  console.log(`[WS] WebSocket server active on ws://localhost:${PORT}/ws`);
  console.log(`[Worker] Background workers ${process.env.ENABLE_WORKERS === 'false' ? 'disabled' : 'enabled'}`);
});
