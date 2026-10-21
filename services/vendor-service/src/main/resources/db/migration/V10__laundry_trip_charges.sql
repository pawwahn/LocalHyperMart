ALTER TABLE laundry_profiles
    ADD COLUMN pickup_charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN drop_charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN pickup_and_drop_charge NUMERIC(12, 2) NOT NULL DEFAULT 0;
