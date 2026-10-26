ALTER TABLE beauty_profiles
    ADD COLUMN IF NOT EXISTS staff_count INT NOT NULL DEFAULT 1;

ALTER TABLE beauty_profiles
    ALTER COLUMN blocked_slot_ids TYPE VARCHAR(512);

UPDATE beauty_profiles SET staff_count = 1 WHERE staff_count IS NULL OR staff_count < 1;
