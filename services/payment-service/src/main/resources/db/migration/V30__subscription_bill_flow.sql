-- Subscription bill flow: admin sends bill -> vendor submits payment -> admin confirms (status PAID).
ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS bill_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_payment_method VARCHAR(32),
    ADD COLUMN IF NOT EXISTS vendor_payment_reference VARCHAR(128),
    ADD COLUMN IF NOT EXISTS vendor_payment_notes VARCHAR(500);
