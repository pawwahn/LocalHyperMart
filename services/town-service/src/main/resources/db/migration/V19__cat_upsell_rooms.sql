-- Categories Upsell is four bookable rooms (1–4), like Mid 1–5.
-- Existing single upsell rows used slot_index 0; they become Cat 1.

ALTER TABLE town_ads DROP CONSTRAINT IF EXISTS chk_town_ads_single_slot_index;

UPDATE town_ads
SET slot_index = 1
WHERE slot = 'CART_UPSELL' AND slot_index = 0;

UPDATE ad_invoices
SET slot_index = 1
WHERE slot = 'CART_UPSELL' AND slot_index = 0;

ALTER TABLE town_ads DROP CONSTRAINT IF EXISTS chk_town_ads_room_index;
ALTER TABLE town_ads
    ADD CONSTRAINT chk_town_ads_room_index
        CHECK (
            (slot = 'HOME_HERO' AND slot_index = 0)
            OR (slot = 'HOME_MID_GRID' AND slot_index BETWEEN 1 AND 5)
            OR (slot = 'CART_UPSELL' AND slot_index BETWEEN 1 AND 4)
        );
