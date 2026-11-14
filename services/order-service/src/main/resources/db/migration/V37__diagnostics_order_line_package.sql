ALTER TABLE diagnostics_order_lines
    ADD COLUMN IF NOT EXISTS package_id UUID,
    ADD COLUMN IF NOT EXISTS package_name VARCHAR(200);
