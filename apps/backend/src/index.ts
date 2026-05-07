import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { router } from './api/routes';
import { initDatabase } from './storage/db';
import { continuityHub } from './diagnostics/continuityHub';
import { logger } from './diagnostics/logger';
import { requestContext, runtimeGuard, validateRuntimeEnvironment } from './diagnostics/runtimeValidation';
import { validateStartup } from './diagnostics/startupValidator';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(requestContext);
app.use(express.json({ limit: '10mb' }));
app.use(runtimeGuard);

app.use('/api', router);

app.use((err: any, req: express.Request, res: express.Response, _next: any) => {
  const debugId = res.getHeader('x-request-id') || 'unknown';
  logger.error('unhandled_api_error', {
    requestId: String(debugId),
    method: req.method,
    path: req.path,
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({
    success: false,
    debugId,
    error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
  });
});

const runtime = validateRuntimeEnvironment();
initDatabase(process.env.DATABASE_PATH);
const startup = validateStartup();

const workersEnabled = process.env.ENABLE_WORKERS === 'true';
if (workersEnabled) {
  import('./workers').then(({ startWorkers }) => startWorkers());
}

const server = createServer(app);
continuityHub.attach(server);

server.listen(PORT, () => {
  logger.info('server_started', {
    port: PORT,
    workersEnabled,
    runtimeStatus: runtime.status,
    startupStatus: startup.status,
    warnings: runtime.warnings,
  });
});
