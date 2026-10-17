ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS vendor_not_received_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_not_received_note VARCHAR(500);
