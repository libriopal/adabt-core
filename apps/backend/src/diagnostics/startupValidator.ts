import { getDB } from '../storage/db';
import { logger } from './logger';
import { validateRuntimeEnvironment } from './runtimeValidation';

export interface StartupValidationReport {
  status: 'ready' | 'degraded';
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
}

const REQUIRED_TABLES = [
  'designs',
  'evolution_runs',
  'demand_cache',
  'reinforcement_events',
];

export function validateStartup(): StartupValidationReport {
  const runtime = validateRuntimeEnvironment();
  const checks: StartupValidationReport['checks'] = [
    {
      name: 'runtime_environment',
      passed: runtime.status === 'ready',
      detail: runtime.warnings.length ? runtime.warnings.join('; ') : 'runtime environment ready',
    },
  ];

  try {
    const database = getDB();
    const journal = database.pragma('journal_mode', { simple: true });
    checks.push({
      name: 'sqlite_wal_mode',
      passed: String(journal).toLowerCase() === 'wal' || runtime.config.databasePath === ':memory:',
      detail: `journal_mode=${journal}`,
    });

    const tableRows = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tables = new Set(tableRows.map(row => row.name));
    const missingTables = REQUIRED_TABLES.filter(table => !tables.has(table));
    checks.push({
      name: 'sqlite_schema',
      passed: missingTables.length === 0,
      detail: missingTables.length ? `missing tables: ${missingTables.join(', ')}` : 'required tables present',
    });
  } catch (error) {
    checks.push({
      name: 'sqlite_startup',
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const status = checks.every(check => check.passed) ? 'ready' : 'degraded';
  logger.info('startup_validation_complete', { status, checks });
  return { status, checks };
}
