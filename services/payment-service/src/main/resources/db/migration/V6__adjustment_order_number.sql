-- Human-readable order ref for vendor claim chargeback UI.
ALTER TABLE vendor_settlement_adjustments
    ADD COLUMN IF NOT EXISTS order_number VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_vendor_settlement_adj_order_number
    ON vendor_settlement_adjustments(order_number);
