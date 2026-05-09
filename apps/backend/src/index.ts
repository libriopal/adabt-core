import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { router } from './api/routes';
import { initDatabase } from './storage/db';

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: IS_PRODUCTION ? false : undefined,  // relax for SPA
}));
app.use(cors({
  origin: IS_PRODUCTION
    ? true  // allow same-origin (frontend served from same host)
    : (process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173']),
}));
app.use(express.json({ limit: '10mb' }));

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api', router);

// ── Serve frontend in production ────────────────────────────────────────────
if (IS_PRODUCTION) {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  // SPA fallback — any non-API route serves index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── Error handler ───────────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, _next: any) => {
  const debugId = `API-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
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

app.listen(PORT, () => {
  console.log(`[Server] SlotGPT Backend running on port ${PORT}`);
  console.log(`[Server] Mode: ${IS_PRODUCTION ? 'production' : 'development'}`);
  console.log(`[Worker] Background workers ${process.env.ENABLE_WORKERS === 'false' ? 'disabled' : 'enabled'}`);
});
