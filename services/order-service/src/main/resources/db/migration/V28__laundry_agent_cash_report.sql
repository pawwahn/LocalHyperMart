ALTER TABLE laundry_orders
    ADD COLUMN IF NOT EXISTS agent_cash_pickup_report VARCHAR(24),
    ADD COLUMN IF NOT EXISTS agent_cash_drop_report VARCHAR(24);
