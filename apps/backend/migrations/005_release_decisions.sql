CREATE TABLE IF NOT EXISTS release_decisions (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  provider TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at INTEGER NOT NULL,
  evidence_checksum TEXT NOT NULL,
  provider_signature TEXT NOT NULL,
  decision_signature TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_decisions_evidence ON release_decisions(evidence_id);
CREATE INDEX IF NOT EXISTS idx_release_decisions_stream_decided ON release_decisions(stream, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_decisions_provider_decided ON release_decisions(provider, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_decisions_decision ON release_decisions(decision, decided_at DESC);
