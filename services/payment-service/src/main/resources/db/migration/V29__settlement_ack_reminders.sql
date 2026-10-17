ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS ack_reminder_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ack_reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_settlements_vendor_ack_pending
    ON settlements (payee_id)
    WHERE ack_reminded_at IS NOT NULL AND vendor_acknowledged_at IS NULL;
