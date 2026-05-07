CREATE TABLE IF NOT EXISTS release_drift_overrides (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL,
  drift_checksum TEXT NOT NULL,
  decision_signature TEXT NOT NULL,
  reason TEXT NOT NULL,
  overridden_by TEXT NOT NULL,
  override_signature TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_drift_overrides_decision ON release_drift_overrides(decision_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_drift_overrides_stream ON release_drift_overrides(stream, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_drift_overrides_provider ON release_drift_overrides(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_drift_overrides_environment ON release_drift_overrides(environment, created_at DESC);
