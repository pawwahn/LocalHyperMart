-- V9's partial unique on any non-null sub_order_id blocked ORDER payouts when an
-- ADJUSTMENT (claim chargeback) already referenced the same sub_order.
-- Uniqueness must apply only to ORDER lines (see V5).
DROP INDEX IF EXISTS uq_settlement_line_sub_order_not_null;

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_line_order_sub_order
    ON settlement_line_items (sub_order_id)
    WHERE line_type = 'ORDER';
