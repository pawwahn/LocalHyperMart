-- Up to 5 mid-grid ads per town (horizontal carousel on buyer home).
ALTER TABLE town_ads
    ADD COLUMN IF NOT EXISTS slot_index SMALLINT NOT NULL DEFAULT 0;

UPDATE town_ads
SET slot_index = 1
WHERE slot = 'HOME_MID_GRID' AND slot_index = 0;

ALTER TABLE town_ads DROP CONSTRAINT IF EXISTS uq_town_ads_town_slot;

ALTER TABLE town_ads
    ADD CONSTRAINT uq_town_ads_town_slot_index UNIQUE (town_id, slot, slot_index);

ALTER TABLE town_ads DROP CONSTRAINT IF EXISTS chk_town_ads_mid_index;
ALTER TABLE town_ads
    ADD CONSTRAINT chk_town_ads_mid_index
        CHECK (slot <> 'HOME_MID_GRID' OR (slot_index >= 1 AND slot_index <= 5));

ALTER TABLE town_ads DROP CONSTRAINT IF EXISTS chk_town_ads_single_slot_index;
ALTER TABLE town_ads
    ADD CONSTRAINT chk_town_ads_single_slot_index
        CHECK (slot = 'HOME_MID_GRID' OR slot_index = 0);

CREATE INDEX IF NOT EXISTS idx_town_ads_town_slot_order ON town_ads (town_id, slot, slot_index);
