ALTER TABLE beauty_profiles
    ADD COLUMN IF NOT EXISTS staff_overrides TEXT NOT NULL DEFAULT '{}';
