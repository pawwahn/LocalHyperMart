ALTER TABLE beauty_orders
    ADD COLUMN IF NOT EXISTS parlour_payment_fee NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN beauty_orders.parlour_payment_fee IS
    'Extra fee when buyer pays minimum online and balance at parlour (town admin setting).';
