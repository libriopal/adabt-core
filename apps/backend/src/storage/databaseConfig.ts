export type DatabaseProvider = 'sqlite' | 'postgres';

export interface DatabaseRuntimeConfig {
  provider: DatabaseProvider;
  sqlitePath: string;
  postgresUrl?: string;
  migrationsEnabled: boolean;
}

function normalizeProvider(value: string | undefined): DatabaseProvider | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'sqlite' || normalized === 'postgres') return normalized;
  return null;
}

export function resolveDatabaseRuntimeConfig(env: NodeJS.ProcessEnv = process.env): DatabaseRuntimeConfig {
  const explicitProvider = normalizeProvider(env.DATABASE_PROVIDER);
  const postgresUrl = env.DATABASE_URL;
  const provider = explicitProvider ?? (postgresUrl ? 'postgres' : 'sqlite');

  return {
    provider,
    sqlitePath: env.DATABASE_PATH || './data/slotgpt.db',
    postgresUrl,
    migrationsEnabled: env.RUN_MIGRATIONS !== 'false',
  };
}

export function describeDatabaseRuntime(config = resolveDatabaseRuntimeConfig()): Record<string, unknown> {
  return {
    provider: config.provider,
    sqlitePath: config.provider === 'sqlite' ? config.sqlitePath : undefined,
    postgresConfigured: Boolean(config.postgresUrl),
    migrationsEnabled: config.migrationsEnabled,
  };
}
