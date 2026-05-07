import { Queue, Worker } from 'bullmq';
import { demandEngine } from '../services/demandEngine';
import { logger } from '../diagnostics/logger';
import { createLocalQueue, createLocalWorker, resolveQueueRuntime } from './queueRuntime';

const queueRuntime = resolveQueueRuntime();
const connection = queueRuntime.mode === 'redis'
  ? { host: queueRuntime.host ?? 'localhost', port: queueRuntime.port ?? 6379 }
  : null;

export const scraperQueue = connection
  ? new Queue('scraper', { connection })
  : createLocalQueue('scraper');

export const scraperWorker = connection
  ? new Worker(
    'scraper',
    async () => {
      logger.info('scraper_worker_demand_update');
      const result = await demandEngine.updateDemand();
      return { score: result.demandScore, keywords: result.keywordClusters };
    },
    { concurrency: 1, connection },
  )
  : createLocalWorker('scraper');

export async function scheduleScraping(): Promise<void> {
  await scraperQueue.add(
    'update',
    {},
    { repeat: { every: 60000 }, jobId: 'periodic_demand_update' },
  );
}
