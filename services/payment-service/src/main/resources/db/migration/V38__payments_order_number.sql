ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_payments_order_number ON payments (order_number);
