ALTER TABLE buyer_membership_purchases
    ADD COLUMN IF NOT EXISTS bundled_order_id UUID;

CREATE INDEX IF NOT EXISTS idx_bmp_bundled_order ON buyer_membership_purchases (bundled_order_id);
