CREATE INDEX IF NOT EXISTS idx_payments_gateway_order ON payments (gateway_order_id);

ALTER TABLE buyer_membership_purchases
    ADD COLUMN gateway_order_id VARCHAR(255),
    ADD COLUMN gateway_payment_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_bmp_gateway_order ON buyer_membership_purchases (gateway_order_id);
