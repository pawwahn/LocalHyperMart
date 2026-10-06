ALTER TABLE carts
    ADD COLUMN IF NOT EXISTS membership_slab VARCHAR(30),
    ADD COLUMN IF NOT EXISTS membership_price_snapshot NUMERIC(12, 2);
