ALTER TABLE laundry_orders
    ADD COLUMN IF NOT EXISTS trip_agent_id UUID,
    ADD COLUMN IF NOT EXISTS trip_agent_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS trip_agent_phone VARCHAR(20);
