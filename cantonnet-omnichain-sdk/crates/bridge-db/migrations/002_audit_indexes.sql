CREATE TABLE transfer_audit_log (
  id BIGSERIAL PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE RESTRICT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_status transfer_status NOT NULL,
  new_status transfer_status NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT
);

CREATE INDEX idx_audit_transfer_id ON transfer_audit_log (transfer_id, at DESC);

CREATE TABLE bridge_checkpoints (
  direction transfer_direction PRIMARY KEY,
  offset_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
