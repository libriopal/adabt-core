import { Router } from 'express';
import { z } from 'zod';
import { batchGenerator } from '../services/batchGenerator';
import { evolutionEngine } from '../services/evolutionEngine';
import { demandEngine } from '../services/demandEngine';
import { reinforcementEngine } from '../services/reinforcementEngine';
import { DesignDB, ReinforcementDB } from '../storage/db';
import { Design } from '../types';

export const router = Router();

function dbgId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
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

router.post('/generate-batch', async (req, res) => {
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
        cacheSize: DesignDB.getStats().total,
      },
    });
  } catch (error) {
    const id = dbgId('GEN');
    console.error(`[${id}] /generate-batch error:`, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/evolve', async (req, res) => {
  try {
    const body = EvolveSchema.parse(req.body);
    let runId: string;

    if (body.resumeRunId) {
      const resumed = await evolutionEngine.resumeEvolution(body.resumeRunId);
      if (!resumed) {
        const id = dbgId('EVO');
        console.error(`[${id}] /evolve resume not found: ${body.resumeRunId}`);
        return res.status(404).json({ success: false, debugId: id, error: 'Run not found or not paused' });
      }
      runId = body.resumeRunId;
    } else {
      let seeds = body.seedDesigns || [];
      if (seeds.length === 0) {
        seeds = DesignDB.getAll({ limit: body.populationSize, minScore: 0.5 });
      }
      if (seeds.length === 0) {
        const id = dbgId('EVO');
        console.error(`[${id}] /evolve no seed designs available`);
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
    const id = dbgId('EVO');
    console.error(`[${id}] /evolve error:`, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/evolve/:runId', (req, res) => {
  const state = evolutionEngine.getState(req.params.runId);
  if (!state) {
    const id = dbgId('EVO');
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

router.post('/evolve/:runId/pause', (req, res) => {
  const paused = evolutionEngine.pauseEvolution(req.params.runId);
  if (!paused) {
    const id = dbgId('EVO');
    return res.status(404).json({ success: false, debugId: id, error: 'Evolution run not running' });
  }
  res.json({ success: true, status: 'paused' });
});

router.get('/designs', (req, res) => {
  const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
  const generation = req.query.generation ? parseInt(req.query.generation as string) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  const designs = DesignDB.getAll({ minScore, generation, limit, offset });
  res.json({ success: true, designs, stats: DesignDB.getStats() });
});

router.get('/designs/:id', (req, res) => {
  const design = DesignDB.getById(req.params.id);
  if (!design) {
    const id = dbgId('DES');
    return res.status(404).json({ success: false, debugId: id, error: 'Design not found' });
  }
  res.json({ success: true, design });
});

router.post('/import', (req, res) => {
  try {
    const body = ImportSchema.parse(req.body);
    const imported = body.designs.map((design: Design) => {
      const toImport = body.preserveIds ? design : {
        ...design,
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      };
      DesignDB.create(toImport as any);
      return toImport;
    });
    res.json({ success: true, imported: imported.length, designs: imported });
  } catch (error) {
    const id = dbgId('IMP');
    console.error(`[${id}] /import error:`, error);
    res.status(400).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/export/:id', (req, res) => {
  const design = DesignDB.getById(req.params.id);
  if (!design) {
    const id = dbgId('DES');
    return res.status(404).json({ success: false, debugId: id, error: 'Design not found' });
  }
  DesignDB.updateExported(design.id, true);
  res.json({ success: true, export: { version: '1.0.0', exportedAt: Date.now(), design } });
});

router.get('/demand', async (req, res) => {
  try {
    const input = typeof req.query.input === 'string' && req.query.input.trim()
      ? req.query.input.trim()
      : undefined;
    const latest = await demandEngine.updateDemand(input);
    res.json({ success: true, demand: latest });
  } catch (error) {
    const id = dbgId('DMD');
    console.error(`[${id}] /demand error:`, error);
    res.status(500).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/reinforcement/replay', async (_req, res) => {
  try {
    const replay = await reinforcementEngine.verifyReplay();
    res.json({ success: true, replay, recent: ReinforcementDB.getLatest(8) });
  } catch (error) {
    const id = dbgId('RFR');
    console.error(`[${id}] /reinforcement/replay error:`, error);
    res.status(500).json({ success: false, debugId: id, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    activeEvolutions: evolutionEngine.getActiveRuns().length,
    database: DesignDB.getStats(),
  });
});
