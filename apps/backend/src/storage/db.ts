import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DBDesign, DBEvolutionRun, DemandResult, Design, EvolutionState, ReinforcementDecision } from '../types';

let db: Database.Database | null = null;

export function initDatabase(dbPath: string = './data/slotgpt.db'): Database.Database {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  createTables();
  return db;
}

export function getDB(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function createTables(): void {
  const database = getDB();

  database.exec(`
    CREATE TABLE IF NOT EXISTS designs (
      id TEXT PRIMARY KEY,
      seed TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      input TEXT NOT NULL,
      mode TEXT NOT NULL,
      intent_vector TEXT NOT NULL,
      mechanics TEXT NOT NULL,
      content TEXT NOT NULL,
      score_total REAL NOT NULL,
      score_demand REAL NOT NULL,
      score_engagement REAL NOT NULL,
      score_novelty REAL NOT NULL,
      score_retention REAL NOT NULL,
      generation INTEGER DEFAULT 0,
      parent_ids TEXT,
      exported BOOLEAN DEFAULT 0,
      archived BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_designs_score ON designs(score_total DESC);
    CREATE INDEX IF NOT EXISTS idx_designs_generation ON designs(generation);
    CREATE INDEX IF NOT EXISTS idx_designs_timestamp ON designs(timestamp);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS evolution_runs (
      id TEXT PRIMARY KEY,
      current_generation INTEGER DEFAULT 0,
      max_generations INTEGER NOT NULL,
      population_size INTEGER NOT NULL,
      mutation_rate REAL NOT NULL,
      elite_ratio REAL NOT NULL,
      designs TEXT NOT NULL,
      history TEXT NOT NULL,
      status TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_evolution_status ON evolution_runs(status);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS demand_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      demand_score REAL NOT NULL,
      trend_vector TEXT NOT NULL,
      keyword_clusters TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS reinforcement_events (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL,
      total REAL NOT NULL,
      axes TEXT NOT NULL,
      weights TEXT NOT NULL,
      gate TEXT NOT NULL,
      mutation_weight REAL NOT NULL,
      lineage TEXT NOT NULL,
      demand_checksum TEXT NOT NULL,
      replay_checksum TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reinforcement_design ON reinforcement_events(design_id);
    CREATE INDEX IF NOT EXISTS idx_reinforcement_created ON reinforcement_events(created_at DESC);
  `);
}

// ─── DesignDB ───────────────────────────────────────────────────────────────

export const DesignDB = {
  create(design: DBDesign | Design): void {
    const database = getDB();
    const stmt = database.prepare(`
      INSERT OR REPLACE INTO designs
        (id, seed, timestamp, input, mode, intent_vector, mechanics, content,
         score_total, score_demand, score_engagement, score_novelty, score_retention,
         generation, parent_ids, exported, archived)
      VALUES
        (@id, @seed, @timestamp, @input, @mode, @intent_vector, @mechanics, @content,
         @score_total, @score_demand, @score_engagement, @score_novelty, @score_retention,
         @generation, @parent_ids, @exported, @archived)
    `);

    stmt.run({
      id: design.id,
      seed: design.seed,
      timestamp: design.timestamp,
      input: design.input,
      mode: design.mode,
      intent_vector: JSON.stringify(design.intentVector),
      mechanics: JSON.stringify(design.mechanics),
      content: JSON.stringify(design.content),
      score_total: design.score.total,
      score_demand: design.score.demand,
      score_engagement: design.score.engagement,
      score_novelty: design.score.novelty,
      score_retention: design.score.retention,
      generation: design.generation ?? 0,
      parent_ids: design.parentIds ? JSON.stringify(design.parentIds) : null,
      exported: (design as DBDesign).exported ? 1 : 0,
      archived: (design as DBDesign).archived ? 1 : 0,
    });
  },

  getById(id: string): DBDesign | null {
    const database = getDB();
    const row = database.prepare('SELECT * FROM designs WHERE id = ?').get(id) as any;
    return row ? rowToDesign(row) : null;
  },

  getAll(opts: {
    minScore?: number;
    generation?: number;
    limit?: number;
    offset?: number;
  } = {}): DBDesign[] {
    const database = getDB();
    const conditions: string[] = ['archived = 0'];
    const params: Record<string, any> = {};

    if (opts.minScore !== undefined) {
      conditions.push('score_total >= @minScore');
      params.minScore = opts.minScore;
    }
    if (opts.generation !== undefined) {
      conditions.push('generation = @generation');
      params.generation = opts.generation;
    }

    params.limit = opts.limit ?? 50;
    params.offset = opts.offset ?? 0;

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = database
      .prepare(`SELECT * FROM designs ${where} ORDER BY score_total DESC LIMIT @limit OFFSET @offset`)
      .all(params) as any[];

    return rows.map(rowToDesign);
  },

  getStats(): { total: number; avgScore: number; topScore: number } {
    const database = getDB();
    const row = database
      .prepare('SELECT COUNT(*) as total, AVG(score_total) as avgScore, MAX(score_total) as topScore FROM designs WHERE archived = 0')
      .get() as any;
    return {
      total: row.total ?? 0,
      avgScore: row.avgScore ?? 0,
      topScore: row.topScore ?? 0,
    };
  },

  updateExported(id: string, exported: boolean): void {
    getDB().prepare('UPDATE designs SET exported = ? WHERE id = ?').run(exported ? 1 : 0, id);
  },
};

function rowToDesign(row: any): DBDesign {
  return {
    id: row.id,
    seed: row.seed,
    timestamp: row.timestamp,
    input: row.input,
    mode: row.mode,
    intentVector: JSON.parse(row.intent_vector),
    mechanics: JSON.parse(row.mechanics),
    content: JSON.parse(row.content),
    score: {
      total: row.score_total,
      demand: row.score_demand,
      engagement: row.score_engagement,
      novelty: row.score_novelty,
      retention: row.score_retention,
    },
    generation: row.generation,
    parentIds: row.parent_ids ? JSON.parse(row.parent_ids) : undefined,
    exported: !!row.exported,
    archived: !!row.archived,
  };
}

// ─── EvolutionDB ─────────────────────────────────────────────────────────────

export const EvolutionDB = {
  create(state: EvolutionState): void {
    const database = getDB();
    const now = Date.now();
    database.prepare(`
      INSERT INTO evolution_runs
        (id, current_generation, max_generations, population_size, mutation_rate,
         elite_ratio, designs, history, status, config, created_at, updated_at)
      VALUES
        (@id, @current_generation, @max_generations, @population_size, @mutation_rate,
         @elite_ratio, @designs, @history, @status, @config, @created_at, @updated_at)
    `).run({
      id: state.runId,
      current_generation: state.currentGeneration,
      max_generations: state.maxGenerations,
      population_size: state.populationSize,
      mutation_rate: state.mutationRate,
      elite_ratio: state.eliteRatio,
      designs: JSON.stringify(state.designs),
      history: JSON.stringify(state.history),
      status: state.status,
      config: JSON.stringify(state.config),
      created_at: now,
      updated_at: now,
    });
  },

  getById(id: string): DBEvolutionRun | null {
    const row = getDB().prepare('SELECT * FROM evolution_runs WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      runId: row.id,
      currentGeneration: row.current_generation,
      maxGenerations: row.max_generations,
      populationSize: row.population_size,
      mutationRate: row.mutation_rate,
      eliteRatio: row.elite_ratio,
      designs: JSON.parse(row.designs),
      history: JSON.parse(row.history),
      status: row.status,
      config: JSON.parse(row.config),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  update(id: string, patch: Partial<EvolutionState>): void {
    const existing = EvolutionDB.getById(id);
    if (!existing) return;

    const updates: string[] = ['updated_at = @updated_at'];
    const params: Record<string, any> = { id, updated_at: Date.now() };

    if (patch.currentGeneration !== undefined) {
      updates.push('current_generation = @current_generation');
      params.current_generation = patch.currentGeneration;
    }
    if (patch.status !== undefined) {
      updates.push('status = @status');
      params.status = patch.status;
    }
    if (patch.history !== undefined) {
      updates.push('history = @history');
      params.history = JSON.stringify(patch.history);
    }
    if (patch.designs !== undefined) {
      updates.push('designs = @designs');
      params.designs = JSON.stringify(patch.designs);
    }

    getDB()
      .prepare(`UPDATE evolution_runs SET ${updates.join(', ')} WHERE id = @id`)
      .run(params);
  },
};

// ─── DemandDB ────────────────────────────────────────────────────────────────

export const DemandDB = {
  save(result: DemandResult): void {
    getDB().prepare(`
      INSERT INTO demand_cache (demand_score, trend_vector, keyword_clusters, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(
      result.demandScore,
      JSON.stringify(result.trendVector),
      JSON.stringify(result.keywordClusters),
      result.timestamp,
    );
  },

  getLatest(): DemandResult | null {
    const row = getDB()
      .prepare('SELECT * FROM demand_cache ORDER BY timestamp DESC LIMIT 1')
      .get() as any;
    if (!row) return null;
    return {
      demandScore: row.demand_score,
      trendVector: JSON.parse(row.trend_vector),
      keywordClusters: JSON.parse(row.keyword_clusters),
      timestamp: row.timestamp,
    };
  },
};

// ─── ReinforcementDB ─────────────────────────────────────────────────────────

export const ReinforcementDB = {
  save(decision: ReinforcementDecision): void {
    getDB().prepare(`
      INSERT OR REPLACE INTO reinforcement_events
        (id, design_id, total, axes, weights, gate, mutation_weight, lineage,
         demand_checksum, replay_checksum, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decision.id,
      decision.designId,
      decision.total,
      JSON.stringify(decision.axes),
      JSON.stringify(decision.weights),
      JSON.stringify(decision.gate),
      decision.mutationWeight,
      JSON.stringify(decision.lineage),
      decision.demandChecksum,
      decision.replayChecksum,
      Date.now(),
    );
  },

  getLatest(limit = 20): ReinforcementDecision[] {
    const rows = getDB()
      .prepare('SELECT * FROM reinforcement_events ORDER BY created_at DESC LIMIT ?')
      .all(limit) as any[];

    return rows.map(row => ({
      id: row.id,
      designId: row.design_id,
      total: row.total,
      axes: JSON.parse(row.axes),
      weights: JSON.parse(row.weights),
      gate: JSON.parse(row.gate),
      mutationWeight: row.mutation_weight,
      lineage: JSON.parse(row.lineage),
      demandChecksum: row.demand_checksum,
      replayChecksum: row.replay_checksum,
    }));
  },
};
