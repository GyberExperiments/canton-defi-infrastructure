CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE transfer_direction AS ENUM ('canton_to_bsc', 'bsc_to_canton');

CREATE TYPE transfer_status AS ENUM (
  'initiated',
  'canton_locking', 'canton_locked',
  'bsc_minting', 'bsc_minted',
  'bsc_burned', 'bsc_burn_finalized',
  'canton_unlocking', 'canton_unlocked',
  'completed', 'failed', 'rolling_back', 'rolled_back', 'stuck'
);

CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trace_id TEXT NOT NULL,
  direction transfer_direction NOT NULL,
  status transfer_status NOT NULL,
  asset_id TEXT NOT NULL,
  amount_raw NUMERIC(78, 0) NOT NULL,
  decimals SMALLINT NOT NULL,
  canton_party TEXT NOT NULL,
  canton_contract_id TEXT,
  canton_command_id TEXT,
  canton_tx_id TEXT,
  bsc_address CHAR(42) NOT NULL,
  bsc_tx_hash CHAR(66),
  bsc_block_number BIGINT,
  bsc_confirmations BIGINT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  error_message TEXT,
  nonce TEXT NOT NULL,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_transfers_canton_command_id ON transfers (canton_command_id) WHERE canton_command_id IS NOT NULL;
CREATE UNIQUE INDEX idx_transfers_bsc_tx_hash ON transfers (bsc_tx_hash) WHERE bsc_tx_hash IS NOT NULL;

CREATE INDEX idx_transfers_status_next_retry
  ON transfers (status, next_retry_at)
  WHERE status NOT IN ('completed', 'failed', 'rolled_back', 'stuck');

CREATE INDEX idx_transfers_direction_created
  ON transfers (direction, created_at DESC);

CREATE INDEX idx_transfers_bsc_block
  ON transfers (bsc_block_number) WHERE bsc_block_number IS NOT NULL;
