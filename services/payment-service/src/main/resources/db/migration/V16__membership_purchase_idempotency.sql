ALTER TABLE buyer_membership_purchases
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_membership_purchases_idempotency_key
    ON buyer_membership_purchases (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
