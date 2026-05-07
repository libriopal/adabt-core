import { evolutionWorker, evolutionQueue } from './evolutionWorker';
import { scraperQueue, scraperWorker, scheduleScraping } from './scraperWorker';
import { logger } from '../diagnostics/logger';
import { resolveQueueRuntime } from './queueRuntime';

export function startWorkers(): void {
  const queueRuntime = resolveQueueRuntime();
  logger.info('workers_starting', { queueMode: queueRuntime.mode });

  scheduleScraping().catch(error => logger.error('scraper_schedule_failed', {
    error: error instanceof Error ? error.message : String(error),
  }));

  process.on('SIGTERM', async () => {
    await evolutionQueue.close();
    await scraperQueue.close();
    await evolutionWorker.close();
    await scraperWorker.close();
    logger.info('workers_stopped');
  });
}

export { evolutionQueue, scraperQueue };
