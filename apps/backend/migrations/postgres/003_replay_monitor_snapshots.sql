CREATE TABLE IF NOT EXISTS replay_monitor_snapshots (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  status TEXT NOT NULL,
  checked_at BIGINT NOT NULL,
  event_count BIGINT NOT NULL,
  checkpoint_count BIGINT NOT NULL,
  latest_checkpoint_id TEXT,
  alert_count BIGINT NOT NULL,
  alerts TEXT NOT NULL,
  report TEXT NOT NULL,
  acknowledged_at BIGINT,
  acknowledged_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_replay_monitor_snapshots_stream_checked ON replay_monitor_snapshots(stream, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_monitor_snapshots_status ON replay_monitor_snapshots(status, checked_at DESC);
