-- Audit log metadata and event sourcing (prompt Part 3.2)
ALTER TABLE transfer_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_at ON transfer_audit_log (at DESC);

CREATE TABLE IF NOT EXISTS transfer_event_log (
  id BIGSERIAL PRIMARY KEY,
  transfer_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_log_transfer_id ON transfer_event_log (transfer_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_at ON transfer_event_log (at DESC);
