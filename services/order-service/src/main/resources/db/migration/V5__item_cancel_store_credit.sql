ALTER TABLE order_items
    ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN cancel_reason TEXT,
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancelled_by UUID,
    ADD COLUMN store_credit_amount DECIMAL(12,2);

ALTER TABLE orders
    ADD COLUMN store_credit_applied DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE INDEX idx_order_items_status ON order_items(status);
