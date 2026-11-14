ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS listing_kind VARCHAR(20) NOT NULL DEFAULT 'GROCERY';

ALTER TABLE cart_items
    ADD CONSTRAINT cart_items_listing_kind_chk CHECK (listing_kind IN ('GROCERY', 'FOOD_MENU'));