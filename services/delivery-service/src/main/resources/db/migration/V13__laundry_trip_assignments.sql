ALTER TABLE delivery_assignments
    ADD COLUMN IF NOT EXISTS source_shop_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS destination_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS destination_phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS destination_address VARCHAR(500),
    ADD COLUMN IF NOT EXISTS laundry_trip_kind VARCHAR(30),
    ADD COLUMN IF NOT EXISTS trip_payment_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS trip_collect_cash NUMERIC(12, 2);
