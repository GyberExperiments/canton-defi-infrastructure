-- Fee and Canton offset for transfers (prompt Part 3)
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS fee_raw NUMERIC(78, 0);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS canton_offset TEXT;

CREATE INDEX IF NOT EXISTS idx_transfers_trace_id ON transfers (trace_id);
