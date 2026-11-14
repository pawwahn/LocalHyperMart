ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_line_kind VARCHAR(20) NOT NULL DEFAULT 'GROCERY';

ALTER TABLE orders
    ADD CONSTRAINT orders_line_kind_chk CHECK (order_line_kind IN ('GROCERY', 'FOOD'));