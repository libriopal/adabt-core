import { DesignDB, ReinforcementDB } from '../storage/db';
import { demandEngine } from '../services/demandEngine';
import { evolutionEngine } from '../services/evolutionEngine';
import { validateRuntimeEnvironment } from './runtimeValidation';
import { runReplaySuite } from './replaySuite';
import { continuityHub } from './continuityHub';

export async function collectSystemDiagnostics() {
  const runtime = validateRuntimeEnvironment();
  const replay = await runReplaySuite();
  const latestDemand = await demandEngine.updateDemand('production readiness');

  return {
    status: runtime.status === 'ready' && replay.stable ? 'ready' : 'degraded',
    timestamp: Date.now(),
    runtime,
    replay,
    database: DesignDB.getStats(),
    activeEvolutions: evolutionEngine.getActiveRuns(),
    continuity: continuityHub.getStatus(),
    demand: {
      checksum: latestDemand.checksum,
      sources: latestDemand.sourceBreakdown?.length || 0,
      reinforcementInputs: latestDemand.reinforcementInputs,
    },
    reinforcement: {
      recentDecisions: ReinforcementDB.getLatest(5).length,
    },
  };
}
