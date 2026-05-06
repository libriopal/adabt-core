import { Queue, Worker, Job } from 'bullmq';
import { Design } from '../types';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const evolutionQueue = new Queue('evolution', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

export const evolutionWorker = new Worker(
  'evolution',
  async (job: Job) => {
    const { runId, generation, designIds } = job.data;
    console.log(`[Worker] Processing evolution batch ${runId}/gen${generation}`);
    return { processed: designIds.length, runId };
  },
  { concurrency: 4, connection },
);

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
