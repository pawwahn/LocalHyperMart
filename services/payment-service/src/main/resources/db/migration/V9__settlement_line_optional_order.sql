-- Allow settlement lines without an order (admin OTHER_CHARGE / penalty rows).
ALTER TABLE settlement_line_items
    ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE settlement_line_items
    ALTER COLUMN sub_order_id DROP NOT NULL;

-- Keep uniqueness for real order lines; multiple null sub_order_id rows are allowed.
ALTER TABLE settlement_line_items
    DROP CONSTRAINT IF EXISTS uq_settlement_line_sub_order;

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_line_sub_order_not_null
    ON settlement_line_items (sub_order_id)
    WHERE sub_order_id IS NOT NULL;
