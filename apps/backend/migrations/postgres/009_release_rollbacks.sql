CREATE TABLE IF NOT EXISTS release_rollbacks (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL,
  planned_at BIGINT NOT NULL,
  approved_at BIGINT,
  approved_by TEXT,
  outcome_at BIGINT,
  outcome TEXT,
  command_id TEXT,
  command_label TEXT,
  promotion_timeline_checksum TEXT NOT NULL,
  rollback_signature TEXT NOT NULL,
  timeline TEXT NOT NULL,
  ci_checks TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_rollbacks_promotion ON release_rollbacks(promotion_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_rollbacks_decision ON release_rollbacks(decision_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_rollbacks_stream ON release_rollbacks(stream, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_rollbacks_provider ON release_rollbacks(provider, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_rollbacks_environment ON release_rollbacks(environment, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_rollbacks_status ON release_rollbacks(status, updated_at DESC);
