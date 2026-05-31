-- Add options-specific fields and exit legs support
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS option_type TEXT CHECK (option_type IN ('call', 'put')),
  ADD COLUMN IF NOT EXISTS option_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS exit_legs JSONB DEFAULT '[]'::jsonb;

-- Index for querying by option type
CREATE INDEX IF NOT EXISTS idx_trades_option_type ON trades (user_id, option_type) WHERE option_type IS NOT NULL;
