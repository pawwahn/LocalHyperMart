-- Seconds each ad stays visible before auto-advancing (mid-grid carousel per slide).
ALTER TABLE town_ads
    ADD COLUMN IF NOT EXISTS display_duration_sec SMALLINT NOT NULL DEFAULT 4;

ALTER TABLE town_ads DROP CONSTRAINT IF EXISTS chk_town_ads_display_duration;
ALTER TABLE town_ads
    ADD CONSTRAINT chk_town_ads_display_duration
        CHECK (display_duration_sec >= 2 AND display_duration_sec <= 60);
