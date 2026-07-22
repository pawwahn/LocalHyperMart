CREATE TABLE order_claims (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    order_item_id UUID REFERENCES order_items(id),
    buyer_id UUID NOT NULL,
    town_id UUID NOT NULL,
    claim_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    reason TEXT NOT NULL,
    resolution VARCHAR(30),
    resolved_amount DECIMAL(12,2),
    resolution_note TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_claims_order ON order_claims(order_id);
CREATE INDEX idx_order_claims_town_status ON order_claims(town_id, status, created_at DESC);
CREATE INDEX idx_order_claims_buyer ON order_claims(buyer_id, created_at DESC);

-- At most one OPEN claim per order line (null item = whole-order claim).
CREATE UNIQUE INDEX uq_order_claims_open_item
    ON order_claims(order_id, order_item_id)
    WHERE status = 'OPEN' AND order_item_id IS NOT NULL;

CREATE UNIQUE INDEX uq_order_claims_open_order
    ON order_claims(order_id)
    WHERE status = 'OPEN' AND order_item_id IS NULL;
