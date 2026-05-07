CREATE TABLE IF NOT EXISTS release_evidence (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  checked_at BIGINT NOT NULL,
  gate_count INTEGER NOT NULL,
  blocked_gate_count INTEGER NOT NULL,
  degraded_gate_count INTEGER NOT NULL,
  latest_monitor_snapshot_id TEXT,
  latest_alert_snapshot_id TEXT,
  rollback_status TEXT NOT NULL,
  latest_degraded_export_checksum TEXT,
  report TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_evidence_stream_checked ON release_evidence(stream, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_evidence_provider_checked ON release_evidence(provider, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_evidence_status ON release_evidence(status, checked_at DESC);
