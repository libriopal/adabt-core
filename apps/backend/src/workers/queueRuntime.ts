import { logger } from '../diagnostics/logger';

export interface QueueRuntimeConfig {
  mode: 'redis' | 'local-fallback';
  host?: string;
  port?: number;
}

export interface QueueLike {
  add(name: string, data: unknown, options?: unknown): Promise<unknown>;
  close(): Promise<void>;
}

export interface WorkerLike {
  close(): Promise<void>;
}

export function resolveQueueRuntime(env: NodeJS.ProcessEnv = process.env): QueueRuntimeConfig {
  const host = env.REDIS_HOST;
  const port = Number.parseInt(env.REDIS_PORT || '6379', 10);
  if (host) return { mode: 'redis', host, port };
  return { mode: 'local-fallback' };
}

export function createLocalQueue(name: string): QueueLike {
  return {
    async add(jobName: string, data: unknown, options?: unknown) {
      logger.info('local_queue_job_recorded', { queue: name, jobName, data, options });
      return { id: `${name}:${jobName}:local`, name: jobName };
    },
    async close() {
      logger.info('local_queue_closed', { queue: name });
    },
  };
}

export function createLocalWorker(name: string): WorkerLike {
  logger.info('local_queue_worker_ready', { queue: name });
  return {
    async close() {
      logger.info('local_queue_worker_closed', { queue: name });
    },
  };
}
