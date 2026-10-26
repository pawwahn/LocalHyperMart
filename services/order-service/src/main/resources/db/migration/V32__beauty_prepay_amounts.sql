ALTER TABLE beauty_orders
    ADD COLUMN IF NOT EXISTS amount_due_total NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE beauty_orders
    ADD COLUMN IF NOT EXISTS prepay_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE beauty_orders
SET amount_due_total = service_amount + travel_charge + platform_fee_amount + cod_fee
WHERE amount_due_total = 0;
