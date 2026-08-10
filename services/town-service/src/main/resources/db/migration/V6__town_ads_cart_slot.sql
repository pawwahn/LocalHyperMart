-- Third ad slot: cart / checkout upsell.
ALTER TABLE town_ads DROP CONSTRAINT IF EXISTS chk_town_ads_slot;
ALTER TABLE town_ads
    ADD CONSTRAINT chk_town_ads_slot
    CHECK (slot IN ('HOME_HERO', 'HOME_MID_GRID', 'CART_UPSELL'));
