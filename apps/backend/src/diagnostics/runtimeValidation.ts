import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';
import { resolveDatabaseRuntimeConfig } from '../storage/databaseConfig';
import { resolveQueueRuntime } from '../workers/queueRuntime';

export interface RuntimeValidationReport {
  status: 'ready' | 'degraded';
  environment: string;
  warnings: string[];
  config: {
    databasePath: string;
    databaseProvider: string;
    postgresConfigured: boolean;
    workersEnabled: boolean;
    redisConfigured: boolean;
    queueMode: string;
    frontendUrl: string;
    logLevel: string;
  };
}

export interface RequestWithContext extends Request {
  requestId?: string;
}

export function validateRuntimeEnvironment(): RuntimeValidationReport {
  const warnings: string[] = [];
  const workersEnabled = process.env.ENABLE_WORKERS === 'true';
  const database = resolveDatabaseRuntimeConfig();
  const queue = resolveQueueRuntime();
  const redisConfigured = queue.mode === 'redis';
  const databasePath = database.sqlitePath;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (process.env.NODE_ENV === 'production' && frontendUrl.includes('localhost')) {
    warnings.push('FRONTEND_URL should be set to the deployed frontend origin in production');
  }

  if (workersEnabled && !redisConfigured) {
    warnings.push('Workers are enabled without REDIS_HOST; deterministic local queue fallback will be used');
  }

  if (
    process.env.NODE_ENV === 'production'
    && database.provider === 'sqlite'
    && (databasePath.includes('apps/backend/data') || databasePath === './data/slotgpt.db')
  ) {
    warnings.push('DATABASE_PATH should point to a persistent volume in hosted production');
  }

  if (database.provider === 'postgres' && !database.postgresUrl) {
    warnings.push('DATABASE_URL is required when DATABASE_PROVIDER=postgres');
  }

  return {
    status: warnings.length > 0 ? 'degraded' : 'ready',
    environment: process.env.NODE_ENV || 'development',
    warnings,
    config: {
      databasePath,
      databaseProvider: database.provider,
      postgresConfigured: Boolean(database.postgresUrl),
      workersEnabled,
      redisConfigured,
      queueMode: queue.mode,
      frontendUrl,
      logLevel: process.env.LOG_LEVEL || 'info',
    },
  };
}

export function requestContext(req: RequestWithContext, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') || randomUUID();
  const start = Date.now();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    logger.info('request_complete', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

export function runtimeGuard(req: RequestWithContext, res: Response, next: NextFunction): void {
  const hasBody = Boolean(req.header('content-length') || req.header('transfer-encoding'));
  if (hasBody && !req.is('application/json') && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    res.status(415).json({
      success: false,
      debugId: req.requestId,
      error: 'Expected application/json request body',
    });
    return;
  }

  next();
}
