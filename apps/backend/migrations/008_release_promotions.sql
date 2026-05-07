CREATE TABLE IF NOT EXISTS release_promotions (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  stopped_at INTEGER,
  approved_at INTEGER,
  approved_by TEXT,
  outcome_at INTEGER,
  outcome TEXT,
  command_id TEXT,
  command_label TEXT,
  supervision_card_checksum TEXT NOT NULL,
  promotion_signature TEXT NOT NULL,
  timeline TEXT NOT NULL,
  ci_checks TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_promotions_decision ON release_promotions(decision_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_promotions_stream ON release_promotions(stream, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_promotions_provider ON release_promotions(provider, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_promotions_environment ON release_promotions(environment, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_promotions_status ON release_promotions(status, updated_at DESC);
