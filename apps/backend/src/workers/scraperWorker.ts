import { Queue, Worker } from 'bullmq';
import { demandEngine } from '../services/demandEngine';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const scraperQueue = new Queue('scraper', { connection });

export const scraperWorker = new Worker(
  'scraper',
  async () => {
    console.log('[Worker] Running demand update');
    const result = await demandEngine.updateDemand();
    return { score: result.demandScore, keywords: result.keywordClusters };
  },
  { concurrency: 1, connection },
);

export async function scheduleScraping(): Promise<void> {
  await scraperQueue.add(
    'update',
    {},
    { repeat: { every: 60000 }, jobId: 'periodic_demand_update' },
  );
}
