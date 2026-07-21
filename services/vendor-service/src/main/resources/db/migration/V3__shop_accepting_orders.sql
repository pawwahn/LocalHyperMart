ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN shops.accepting_orders IS 'When false, shop is paused: hidden from town browse until resumed.';
