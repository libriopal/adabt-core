import { evolutionWorker, evolutionQueue } from './evolutionWorker';
import { scraperQueue, scraperWorker, scheduleScraping } from './scraperWorker';

export function startWorkers(): void {
  console.log('[Worker] Starting background processors...');

  scheduleScraping().catch(console.error);

  process.on('SIGTERM', async () => {
    await evolutionQueue.close();
    await scraperQueue.close();
    await evolutionWorker.close();
    await scraperWorker.close();
  });
}

export { evolutionQueue, scraperQueue };
