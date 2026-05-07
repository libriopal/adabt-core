import { demandEngine } from '../services/demandEngine';
import { reinforcementEngine } from '../services/reinforcementEngine';
import { persistReplaySuiteResult, ReplayPersistenceResult } from './replayHistory';

export interface ReplaySuiteResult {
  stable: boolean;
  checks: Array<{
    name: string;
    stable: boolean;
    checksum?: string;
    details: Record<string, unknown>;
  }>;
  persistence?: ReplayPersistenceResult;
}

export interface ReplaySuiteOptions {
  persist?: boolean;
}

export async function runReplaySuite(options: ReplaySuiteOptions = {}): Promise<ReplaySuiteResult> {
  const demandA = await demandEngine.updateDemand('mythic bonus volatility');
  const demandB = await demandEngine.updateDemand('mythic bonus volatility');
  const reinforcement = await reinforcementEngine.verifyReplay();

  const checks = [
    {
      name: 'demand_replay',
      stable: demandA.checksum === demandB.checksum,
      checksum: demandA.checksum,
      details: {
        firstChecksum: demandA.checksum,
        secondChecksum: demandB.checksum,
        sources: demandA.sourceBreakdown?.length || 0,
      },
    },
    {
      name: 'reinforcement_replay',
      stable: reinforcement.stable,
      checksum: reinforcement.checksum,
      details: reinforcement as unknown as Record<string, unknown>,
    },
  ];

  const result: ReplaySuiteResult = {
    stable: checks.every(check => check.stable),
    checks,
  };

  if (options.persist !== false) {
    result.persistence = await persistReplaySuiteResult(result);
  }

  return result;
}
