import { Router } from 'express';
import { z } from 'zod';
import { batchGenerator } from '../services/batchGenerator';
import { evolutionEngine } from '../services/evolutionEngine';
import { demandEngine } from '../services/demandEngine';
import { reinforcementEngine } from '../services/reinforcementEngine';
import { getStorageRepository } from '../storage/repository';
import { Design } from '../types';
import { continuityHub } from '../diagnostics/continuityHub';
import { createContinuityExport, createDegradedReplayExport } from '../diagnostics/continuityExport';
import { logger } from '../diagnostics/logger';
import {
  DEFAULT_REPLAY_STREAM,
  acknowledgeReplayMonitorSnapshot,
  diffReplayCheckpoints,
  getReplayMonitorHistory,
  getReplayHistory,
  monitorReplayHistory,
} from '../diagnostics/replayHistory';
import { runReplaySuite } from '../diagnostics/replaySuite';
import { collectReleaseReadiness } from '../diagnostics/releaseReadiness';
import { collectSystemDiagnostics } from '../diagnostics/systemDiagnostics';
import { RequestWithContext, validateRuntimeEnvironment } from '../diagnostics/runtimeValidation';

export const router = Router();

function dbgId(prefix: string, req?: RequestWithContext) {
  return req?.requestId || `${prefix}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}

function logRouteError(prefix: string, req: RequestWithContext, error: unknown) {
  const id = dbgId(prefix, req);
  logger.error('route_error', {
    debugId: id,
    route: req.path,
    method: req.method,
    error: error instanceof Error ? error.message : String(error),
  });
  return id;
}

const GenerateBatchSchema = z.object({
  input: z.string().min(1),
  count: z.number().int().min(1).max(100).default(10),
  mode: z.enum(['FAST', 'FULL', 'HYBRID']).default('FULL'),
  differentialCurve: z.enum(['linear', 'exponential', 'parabola', 'sigmoid']).optional(),
});

const EvolveSchema = z.object({
  seedDesigns: z.array(z.any()).optional(),
  maxGenerations: z.number().int().min(10).max(1000).default(100),
  populationSize: z.number().int().min(10).max(500).default(50),
  mutationRate: z.number().min(0).max(1).default(0.1),
  resumeRunId: z.string().optional(),
});

const ImportSchema = z.object({
  designs: z.array(z.any()),
  preserveIds: z.boolean().default(false),
});

const ReplayHistoryQuerySchema = z.object({
  stream: z.string().min(1).default(DEFAULT_REPLAY_STREAM),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

const ReplayVerifyQuerySchema = z.object({
  persist: z.preprocess(value => (
    value === undefined ? true : !['false', '0', 'no'].includes(String(value).toLowerCase())
  ), z.boolean()).default(true),
});

const ReplayDiffQuerySchema = z.object({
  stream: z.string().min(1).default(DEFAULT_REPLAY_STREAM),
  baseId: z.string().min(1),
  targetId: z.string().min(1),
});

const ContinuityExportQuerySchema = ReplayHistoryQuerySchema.extend({
  checkpointId: z.string().min(1).optional(),
});

const ReplayMonitorQuerySchema = z.object({
  stream: z.string().min(1).default(DEFAULT_REPLAY_STREAM),
  persist: z.preprocess(value => (
    value === undefined ? true : !['false', '0', 'no'].includes(String(value).toLowerCase())
  ), z.boolean()).default(true),
});

const ReplayMonitorHistoryQuerySchema = ReplayHistoryQuerySchema;

const ReplayMonitorAckSchema = z.object({
  acknowledgedBy: z.string().min(1).default('operator'),
});

const DegradedReplayExportQuerySchema = ContinuityExportQuerySchema.extend({
  snapshotId: z.string().min(1).optional(),
});

const ReleaseReadinessQuerySchema = z.object({
  stream: z.string().min(1).default(DEFAULT_REPLAY_STREAM),
  persistMonitor: z.preprocess(value => (
    value === undefined ? true : !['false', '0', 'no'].includes(String(value).toLowerCase())
  ), z.boolean()).default(true),
});

router.post('/generate-batch', async (req: RequestWithContext, res) => {
  try {
    const body = GenerateBatchSchema.parse(req.body);
    const startTime = Date.now();

    const designs = await batchGenerator.generateBatch({
      count: body.count,
      mode: body.mode,
      inputBase: body.input,
      differentialCurve: body.differentialCurve,
    });

    res.json({
      success: true,
      designs,
      meta: {
        count: designs.length,
        executionTime: Date.now() - startTime,
        cacheSize: (await getStorageRepository().designs.getStats()).total,
      },
    });
  } catch (error) {
    const id = logRouteError('GEN', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/evolve', async (req: RequestWithContext, res) => {
  try {
    const body = EvolveSchema.parse(req.body);
    let runId: string;

    if (body.resumeRunId) {
      const resumed = await evolutionEngine.resumeEvolution(body.resumeRunId);
      if (!resumed) {
        const id = dbgId('EVO', req);
        logger.warn('evolution_resume_not_found', { debugId: id, runId: body.resumeRunId });
        return res.status(404).json({ success: false, debugId: id, error: 'Run not found or not paused' });
      }
      runId = body.resumeRunId;
      continuityHub.resume(runId);
    } else {
      let seeds = body.seedDesigns || [];
      if (seeds.length === 0) {
        seeds = await getStorageRepository().designs.getAll({ limit: body.populationSize, minScore: 0.5 });
      }
      if (seeds.length === 0) {
        const id = dbgId('EVO', req);
        logger.warn('evolution_seed_designs_missing', { debugId: id });
        return res.status(400).json({ success: false, debugId: id, error: 'No seed designs available. Generate a batch first.' });
      }

      runId = await evolutionEngine.startEvolution(seeds, {
        populationSize: body.populationSize,
        maxGenerations: body.maxGenerations,
        mutationRate: body.mutationRate,
        eliteRatio: 0.1,
        crossoverRate: 0.8,
        parallelBatches: 4,
      });
    }

    res.json({ success: true, runId, status: 'running' });
  } catch (error) {
    const id = logRouteError('EVO', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/evolve/:runId', async (req: RequestWithContext, res) => {
  const state = await evolutionEngine.getStateFromStore(req.params.runId);
  if (!state) {
    const id = dbgId('EVO', req);
    return res.status(404).json({ success: false, debugId: id, error: 'Evolution run not found' });
  }

  res.json({
    success: true,
    state: {
      runId: state.runId,
      currentGeneration: state.currentGeneration,
      maxGenerations: state.maxGenerations,
      status: state.status,
      history: state.history,
      bestScore: state.history.length > 0 ? Math.max(...state.history.map(h => h.maxScore)) : null,
    },
  });
});

router.post('/evolve/:runId/pause', async (req: RequestWithContext, res) => {
  const paused = await evolutionEngine.pauseEvolution(req.params.runId);
  if (!paused) {
    const id = dbgId('EVO', req);
    return res.status(404).json({ success: false, debugId: id, error: 'Evolution run not running' });
  }
  continuityHub.interrupt(req.params.runId, 'pause_endpoint');
  res.json({ success: true, status: 'paused' });
});

router.get('/designs', async (req, res) => {
  const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
  const generation = req.query.generation ? parseInt(req.query.generation as string) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  const designs = await getStorageRepository().designs.getAll({ minScore, generation, limit, offset });
  const stats = await getStorageRepository().designs.getStats();
  res.json({ success: true, designs, stats });
});

router.get('/designs/:id', async (req: RequestWithContext, res) => {
  const design = await getStorageRepository().designs.getById(req.params.id);
  if (!design) {
    const id = dbgId('DES', req);
    return res.status(404).json({ success: false, debugId: id, error: 'Design not found' });
  }
  res.json({ success: true, design });
});

router.post('/import', async (req: RequestWithContext, res) => {
  try {
    const body = ImportSchema.parse(req.body);
    const imported = await Promise.all(body.designs.map(async (design: Design) => {
      const toImport = body.preserveIds ? design : {
        ...design,
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      };
      await getStorageRepository().designs.create(toImport as any);
      return toImport;
    }));
    res.json({ success: true, imported: imported.length, designs: imported });
  } catch (error) {
    const id = logRouteError('IMP', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/export/:id', async (req: RequestWithContext, res) => {
  const design = await getStorageRepository().designs.getById(req.params.id);
  if (!design) {
    const id = dbgId('DES', req);
    return res.status(404).json({ success: false, debugId: id, error: 'Design not found' });
  }
  await getStorageRepository().designs.updateExported(design.id, true);
  res.json({ success: true, export: { version: '1.0.0', exportedAt: Date.now(), design } });
});

router.get('/demand', async (req: RequestWithContext, res) => {
  try {
    const input = typeof req.query.input === 'string' && req.query.input.trim()
      ? req.query.input.trim()
      : undefined;
    const latest = await demandEngine.updateDemand(input);
    res.json({ success: true, demand: latest });
  } catch (error) {
    const id = logRouteError('DMD', req, error);
    res.status(500).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/reinforcement/replay', async (req: RequestWithContext, res) => {
  try {
    const replay = await reinforcementEngine.verifyReplay();
    res.json({ success: true, replay, recent: await getStorageRepository().reinforcement.getLatest(8) });
  } catch (error) {
    const id = logRouteError('RFR', req, error);
    res.status(500).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/replay/verify', async (req: RequestWithContext, res) => {
  try {
    const query = ReplayVerifyQuerySchema.parse(req.query);
    const replay = await runReplaySuite({ persist: query.persist });
    res.status(replay.stable ? 200 : 503).json({ success: replay.stable, replay });
  } catch (error) {
    const id = logRouteError('RPY', req, error);
    res.status(500).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/replay/monitor', async (req: RequestWithContext, res) => {
  try {
    const query = ReplayMonitorQuerySchema.parse(req.query);
    const monitor = await monitorReplayHistory(query.stream, { persist: query.persist });
    res.status(monitor.status === 'ready' ? 200 : 503).json({
      success: true,
      monitor,
    });
  } catch (error) {
    const id = logRouteError('RPM', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/replay/monitor/history', async (req: RequestWithContext, res) => {
  try {
    const query = ReplayMonitorHistoryQuerySchema.parse(req.query);
    const snapshots = await getReplayMonitorHistory(query.stream, query.limit);
    res.json({ success: true, snapshots });
  } catch (error) {
    const id = logRouteError('RPH', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/replay/monitor/:snapshotId/ack', async (req: RequestWithContext, res) => {
  try {
    const body = ReplayMonitorAckSchema.parse(req.body ?? {});
    const snapshot = await acknowledgeReplayMonitorSnapshot(req.params.snapshotId, body.acknowledgedBy);
    res.json({ success: true, snapshot });
  } catch (error) {
    const id = logRouteError('RPA', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/replay/history', async (req: RequestWithContext, res) => {
  try {
    const query = ReplayHistoryQuerySchema.parse(req.query);
    const history = await getReplayHistory(query.stream, query.limit);
    res.status(history.verification.stable ? 200 : 503).json({
      success: history.verification.stable,
      history,
    });
  } catch (error) {
    const id = logRouteError('RPH', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/replay/checkpoints/diff', async (req: RequestWithContext, res) => {
  try {
    const query = ReplayDiffQuerySchema.parse(req.query);
    const diff = await diffReplayCheckpoints(query.baseId, query.targetId, query.stream);
    res.json({ success: true, diff });
  } catch (error) {
    const id = logRouteError('RPD', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/replay/degraded-export', async (req: RequestWithContext, res) => {
  try {
    const query = DegradedReplayExportQuerySchema.parse(req.query);
    const degradedExport = await createDegradedReplayExport(query);
    res.status(degradedExport.monitor.status === 'ready' ? 200 : 503).json({
      success: true,
      export: degradedExport,
    });
  } catch (error) {
    const id = logRouteError('RPE', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/continuity/status', (_req, res) => {
  res.json({ success: true, continuity: continuityHub.getStatus() });
});

router.get('/continuity/export', async (req: RequestWithContext, res) => {
  try {
    const query = ContinuityExportQuerySchema.parse(req.query);
    const continuityExport = await createContinuityExport(query);
    res.json({ success: true, export: continuityExport });
  } catch (error) {
    const id = logRouteError('CTX', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/release/readiness', async (req: RequestWithContext, res) => {
  try {
    const query = ReleaseReadinessQuerySchema.parse(req.query);
    const release = await collectReleaseReadiness({
      stream: query.stream,
      persistMonitor: query.persistMonitor,
    });
    res.status(release.status === 'ready' ? 200 : 503).json({
      success: true,
      release,
    });
  } catch (error) {
    const id = logRouteError('REL', req, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/continuity/:runId/interrupt', async (req: RequestWithContext, res) => {
  const paused = await evolutionEngine.pauseEvolution(req.params.runId);
  const event = continuityHub.interrupt(req.params.runId, typeof req.body?.reason === 'string' ? req.body.reason : 'manual');
  res.status(paused ? 200 : 202).json({ success: true, paused, event });
});

router.post('/continuity/:runId/resume', async (req: RequestWithContext, res) => {
  try {
    const resumed = await evolutionEngine.resumeEvolution(req.params.runId);
    const event = continuityHub.resume(req.params.runId);
    res.status(resumed ? 200 : 202).json({ success: true, resumed, event });
  } catch (error) {
    const id = logRouteError('CTY', req, error);
    res.status(500).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/ready', async (req, res) => {
  const runtime = validateRuntimeEnvironment();
  const status = runtime.status === 'ready' ? 'ready' : 'degraded';
  res.status(status === 'ready' ? 200 : 503).json({
    success: status === 'ready',
    status,
    timestamp: Date.now(),
    runtime,
    database: await getStorageRepository().designs.getStats(),
    requestId: (req as RequestWithContext).requestId,
  });
});

router.get('/diagnostics', async (req: RequestWithContext, res) => {
  try {
    const diagnostics = await collectSystemDiagnostics();
    res.status(diagnostics.status === 'ready' ? 200 : 503).json({ success: diagnostics.status === 'ready', diagnostics });
  } catch (error) {
    const id = logRouteError('DGN', req, error);
    res.status(500).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/health', async (req, res) => {
  const runtime = validateRuntimeEnvironment();
  res.json({
    status: runtime.status === 'ready' ? 'healthy' : 'degraded',
    timestamp: Date.now(),
    uptimeSeconds: process.uptime(),
    activeEvolutions: evolutionEngine.getActiveRuns().length,
    continuity: continuityHub.getStatus(),
    runtime,
    database: await getStorageRepository().designs.getStats(),
    requestId: (req as RequestWithContext).requestId,
  });
});
