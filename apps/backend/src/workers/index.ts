export async function startWorkers(): Promise<void> {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');

  console.log(`[Worker] Attempting to connect to Redis at ${redisHost}:${redisPort}...`);

  try {
    const { evolutionWorker, evolutionQueue } = await import('./evolutionWorker');
    const { scraperQueue, scraperWorker, scheduleScraping } = await import('./scraperWorker');

    console.log('[Worker] Starting background processors...');
    await scheduleScraping();

    process.on('SIGTERM', async () => {
      await evolutionQueue.close();
      await scraperQueue.close();
      await evolutionWorker.close();
      await scraperWorker.close();
    });

    console.log('[Worker] Background processors started successfully.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Worker] Could not start workers: ${message}`);
    console.warn('[Worker] API will continue without background jobs. Set ENABLE_WORKERS=false to suppress this.');
  }
}
