ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'PAYOUT';

CREATE INDEX IF NOT EXISTS idx_settlements_direction ON settlements(direction);
