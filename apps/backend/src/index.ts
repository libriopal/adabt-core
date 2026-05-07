import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { router } from './api/routes';
import { initDatabase } from './storage/db';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173'],
}));
app.use(express.json({ limit: '10mb' }));

app.use('/api', router);

app.use((err: any, req: express.Request, res: express.Response, _next: any) => {
  const debugId = `API-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  console.error(`[${debugId}] Unhandled API error on ${req.method} ${req.path}:`, err);
  res.status(500).json({
    success: false,
    debugId,
    error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
  });
});

initDatabase();

if (process.env.ENABLE_WORKERS !== 'false') {
  import('./workers').then(({ startWorkers }) => startWorkers());
}

app.listen(PORT, () => {
  console.log(`[Server] SlotGPT Backend running on port ${PORT}`);
  console.log(`[Worker] Background workers ${process.env.ENABLE_WORKERS === 'false' ? 'disabled' : 'enabled'}`);
});
