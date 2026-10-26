ALTER TABLE beauty_orders
    ADD COLUMN IF NOT EXISTS prepay_mode VARCHAR(10) NOT NULL DEFAULT 'FULL';

UPDATE beauty_orders
SET prepay_mode = 'PARTIAL'
WHERE prepay_mode = 'FULL'
  AND (parlour_payment_fee > 0 OR payment_status = 'PARTIAL');

CREATE TABLE IF NOT EXISTS beauty_order_ratings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL UNIQUE REFERENCES beauty_orders (id) ON DELETE CASCADE,
    buyer_id    UUID NOT NULL,
    vendor_id   UUID NOT NULL,
    town_id     UUID NOT NULL,
    stars       SMALLINT NOT NULL,
    comment     VARCHAR(400),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beauty_order_ratings_vendor ON beauty_order_ratings (vendor_id, created_at DESC);
