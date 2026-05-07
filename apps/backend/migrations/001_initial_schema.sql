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

CREATE TABLE IF NOT EXISTS demand_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  demand_score REAL NOT NULL,
  trend_vector TEXT NOT NULL,
  keyword_clusters TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
