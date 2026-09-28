ALTER TABLE buyer_membership_purchases
    ADD COLUMN IF NOT EXISTS seller_phone_snapshot VARCHAR(15);
