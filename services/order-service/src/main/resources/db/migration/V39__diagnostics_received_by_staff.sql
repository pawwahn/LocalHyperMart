ALTER TABLE diagnostics_orders
    ADD COLUMN IF NOT EXISTS received_by_staff_id UUID,
    ADD COLUMN IF NOT EXISTS received_by_staff_name VARCHAR(120);
