ALTER TABLE laundry_profiles
    ADD COLUMN blocked_pickup_date DATE,
    ADD COLUMN blocked_pickup_slots VARCHAR(40) NOT NULL DEFAULT '';
