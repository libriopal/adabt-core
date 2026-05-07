import { getStorageRepository } from '../storage/repository';
import { demandEngine } from '../services/demandEngine';
import { evolutionEngine } from '../services/evolutionEngine';
import { validateRuntimeEnvironment } from './runtimeValidation';
import { runReplaySuite } from './replaySuite';
import { continuityHub } from './continuityHub';
import { monitorReplayHistory, verifyReplayHistory } from './replayHistory';

export async function collectSystemDiagnostics() {
  const runtime = validateRuntimeEnvironment();
  const replay = await runReplaySuite();
  const latestDemand = await demandEngine.updateDemand('production readiness');
  const database = await getStorageRepository().designs.getStats();
  const recentDecisions = await getStorageRepository().reinforcement.getLatest(5);
  const replayHistory = await verifyReplayHistory();
  const replayMonitor = await monitorReplayHistory();

  return {
    status: runtime.status === 'ready' && replay.stable && replayMonitor.status === 'ready' ? 'ready' : 'degraded',
    timestamp: Date.now(),
    runtime,
    replay,
    replayHistory,
    replayMonitor,
    database,
    activeEvolutions: evolutionEngine.getActiveRuns(),
    continuity: continuityHub.getStatus(),
    demand: {
      checksum: latestDemand.checksum,
      sources: latestDemand.sourceBreakdown?.length || 0,
      reinforcementInputs: latestDemand.reinforcementInputs,
    },
    reinforcement: {
      recentDecisions: recentDecisions.length,
    },
  };
}
