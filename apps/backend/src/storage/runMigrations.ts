import { runConfiguredMigrations } from './migrations';

runConfiguredMigrations()
  .then(result => {
    console.log(JSON.stringify({
      provider: result.provider,
      applied: result.applied,
      skipped: result.skipped,
    }));
  })
  .catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
