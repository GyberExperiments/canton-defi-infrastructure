-- Asset Registry and daily volumes (prompt Part 3.3)
CREATE TABLE IF NOT EXISTS asset_registry (
  id TEXT PRIMARY KEY,
  canton_template_id TEXT NOT NULL UNIQUE,
  bsc_token_address CHAR(42) NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals SMALLINT NOT NULL,
  min_transfer_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  max_transfer_raw NUMERIC(78,0),
  daily_limit_raw NUMERIC(78,0),
  fixed_fee_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  proportional_bps INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_daily_volumes (
  asset_id TEXT NOT NULL REFERENCES asset_registry(id),
  date DATE NOT NULL,
  volume_raw NUMERIC(78,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (asset_id, date)
);

CREATE INDEX IF NOT EXISTS idx_asset_volumes_date ON asset_daily_volumes (date DESC);
