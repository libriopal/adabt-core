CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  seed TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  input TEXT NOT NULL,
  mode TEXT NOT NULL,
  intent_vector TEXT NOT NULL,
  mechanics TEXT NOT NULL,
  content TEXT NOT NULL,
  score_total DOUBLE PRECISION NOT NULL,
  score_demand DOUBLE PRECISION NOT NULL,
  score_engagement DOUBLE PRECISION NOT NULL,
  score_novelty DOUBLE PRECISION NOT NULL,
  score_retention DOUBLE PRECISION NOT NULL,
  generation INTEGER DEFAULT 0,
  parent_ids TEXT,
  exported BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_designs_score ON designs(score_total DESC);
CREATE INDEX IF NOT EXISTS idx_designs_generation ON designs(generation);
CREATE INDEX IF NOT EXISTS idx_designs_timestamp ON designs(timestamp);

CREATE TABLE IF NOT EXISTS evolution_runs (
  id TEXT PRIMARY KEY,
  current_generation INTEGER DEFAULT 0,
  max_generations INTEGER NOT NULL,
  population_size INTEGER NOT NULL,
  mutation_rate DOUBLE PRECISION NOT NULL,
  elite_ratio DOUBLE PRECISION NOT NULL,
  designs TEXT NOT NULL,
  history TEXT NOT NULL,
  status TEXT NOT NULL,
  config TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evolution_status ON evolution_runs(status);

CREATE TABLE IF NOT EXISTS demand_cache (
  id BIGSERIAL PRIMARY KEY,
  demand_score DOUBLE PRECISION NOT NULL,
  trend_vector TEXT NOT NULL,
  keyword_clusters TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reinforcement_events (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL,
  total DOUBLE PRECISION NOT NULL,
  axes TEXT NOT NULL,
  weights TEXT NOT NULL,
  gate TEXT NOT NULL,
  mutation_weight DOUBLE PRECISION NOT NULL,
  lineage TEXT NOT NULL,
  demand_checksum TEXT NOT NULL,
  replay_checksum TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reinforcement_design ON reinforcement_events(design_id);
CREATE INDEX IF NOT EXISTS idx_reinforcement_created ON reinforcement_events(created_at DESC);
