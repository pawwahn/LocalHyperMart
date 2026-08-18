-- Network-wide ads: when true, this live creative is served to every town
-- unless that town has its own live ad in the same slot.
ALTER TABLE town_ads
    ADD COLUMN IF NOT EXISTS all_towns BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_town_ads_all_towns
    ON town_ads (slot, slot_index, updated_at DESC)
    WHERE all_towns = TRUE AND enabled = TRUE;
