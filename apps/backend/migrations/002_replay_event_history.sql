CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  payload TEXT NOT NULL,
  replay_checksum TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(stream, sequence)
);

CREATE INDEX IF NOT EXISTS idx_event_log_stream_sequence ON event_log(stream, sequence);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at DESC);

CREATE TABLE IF NOT EXISTS replay_checkpoints (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  label TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  replay_checksum TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_checkpoints_stream ON replay_checkpoints(stream, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_checkpoints_created ON replay_checkpoints(created_at DESC);
