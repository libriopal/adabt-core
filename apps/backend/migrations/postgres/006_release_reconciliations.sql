CREATE TABLE IF NOT EXISTS release_reconciliations (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  provider TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  pull_request_url TEXT,
  source_thread TEXT,
  initiated_by TEXT,
  decision_signature TEXT NOT NULL,
  evidence_checksum TEXT NOT NULL,
  provider_signature TEXT NOT NULL,
  reconciliation_signature TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_reconciliations_decision ON release_reconciliations(decision_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_reconciliations_stream ON release_reconciliations(stream, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_reconciliations_provider ON release_reconciliations(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_reconciliations_commit ON release_reconciliations(commit_sha, created_at DESC);
