ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS vendor_acknowledged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_acknowledged_by UUID;
