import { Queue, Worker, Job } from 'bullmq';
import { Design } from '../types';
import { logger } from '../diagnostics/logger';
import { createLocalQueue, createLocalWorker, resolveQueueRuntime } from './queueRuntime';

const queueRuntime = resolveQueueRuntime();
const connection = queueRuntime.mode === 'redis'
  ? { host: queueRuntime.host ?? 'localhost', port: queueRuntime.port ?? 6379 }
  : null;

export const evolutionQueue = connection
  ? new Queue('evolution', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    },
  })
  : createLocalQueue('evolution');

export const evolutionWorker = connection
  ? new Worker(
    'evolution',
    async (job: Job) => {
      const { runId, generation, designIds } = job.data;
      logger.info('evolution_worker_batch', { runId, generation, designCount: designIds.length });
      return { processed: designIds.length, runId };
    },
    { concurrency: 4, connection },
  )
  : createLocalWorker('evolution');

export async function queueEvolutionBatch(
  runId: string,
  generation: number,
  designs: Design[],
): Promise<void> {
  await evolutionQueue.add(
    'evaluate',
    { runId, generation, designIds: designs.map(d => d.id) },
    { jobId: `${runId}_${generation}`, priority: generation < 50 ? 10 : 5 },
  );
}
