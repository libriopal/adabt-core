import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { resolveDatabaseRuntimeConfig, type DatabaseRuntimeConfig } from './databaseConfig';

export interface MigrationResult {
  provider: 'sqlite' | 'postgres';
  applied: string[];
  skipped: string[];
}

interface MigrationFile {
  id: string;
  path: string;
  sql: string;
}

function findBackendRoot(): string {
  const candidates = [
    process.cwd(),
    path.join(process.cwd(), 'apps/backend'),
    path.resolve(__dirname, '../..'),
  ];

  const root = candidates.find(candidate => fs.existsSync(path.join(candidate, 'migrations')));
  if (!root) {
    throw new Error('Unable to locate apps/backend/migrations');
  }
  return root;
}

function readMigrationFiles(provider: 'sqlite' | 'postgres'): MigrationFile[] {
  const backendRoot = findBackendRoot();
  const providerDir = path.join(backendRoot, 'migrations', provider);
  const migrationDir = fs.existsSync(providerDir) ? providerDir : path.join(backendRoot, 'migrations');

  return fs.readdirSync(migrationDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => ({
      id: file,
      path: path.join(migrationDir, file),
      sql: fs.readFileSync(path.join(migrationDir, file), 'utf8'),
    }));
}

export function runSqliteMigrations(database: Database.Database): MigrationResult {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of readMigrationFiles('sqlite')) {
    const existing = database
      .prepare('SELECT id FROM schema_migrations WHERE id = ?')
      .get(migration.id);
    if (existing) {
      skipped.push(migration.id);
      continue;
    }

    const apply = database.transaction(() => {
      database.exec(migration.sql);
      database.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
        .run(migration.id, Date.now());
    });
    apply();
    applied.push(migration.id);
  }

  return { provider: 'sqlite', applied, skipped };
}

export async function runPostgresMigrations(databaseUrl: string): Promise<MigrationResult> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at BIGINT NOT NULL
      );
    `);

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const migration of readMigrationFiles('postgres')) {
      const existing = await client.query('SELECT id FROM schema_migrations WHERE id = $1', [migration.id]);
      if (existing.rowCount && existing.rowCount > 0) {
        skipped.push(migration.id);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)', [
          migration.id,
          Date.now(),
        ]);
        await client.query('COMMIT');
        applied.push(migration.id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return { provider: 'postgres', applied, skipped };
  } finally {
    await client.end();
  }
}

export async function runConfiguredMigrations(
  config: DatabaseRuntimeConfig = resolveDatabaseRuntimeConfig(),
): Promise<MigrationResult> {
  if (!config.migrationsEnabled) {
    return { provider: config.provider, applied: [], skipped: [] };
  }

  if (config.provider === 'postgres') {
    if (!config.postgresUrl) {
      throw new Error('DATABASE_URL is required when DATABASE_PROVIDER=postgres');
    }
    return runPostgresMigrations(config.postgresUrl);
  }

  const dir = path.dirname(config.sqlitePath);
  if (config.sqlitePath !== ':memory:') {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(config.sqlitePath);
  try {
    sqlite.pragma('journal_mode = WAL');
    return runSqliteMigrations(sqlite);
  } finally {
    sqlite.close();
  }
}
