ALTER TABLE beauty_profiles
    ADD COLUMN IF NOT EXISTS slot_day_open TIME NOT NULL DEFAULT '08:00';

ALTER TABLE beauty_profiles
    ADD COLUMN IF NOT EXISTS slot_day_close TIME NOT NULL DEFAULT '20:00';

ALTER TABLE beauty_profiles
    ADD COLUMN IF NOT EXISTS slot_interval_minutes INT NOT NULL DEFAULT 45;
