ALTER TABLE laundry_orders
    ADD COLUMN logistics_charge NUMERIC(12, 2) NOT NULL DEFAULT 0;
