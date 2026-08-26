CREATE TABLE order_scratch_cards (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
    buyer_id UUID NOT NULL,
    town_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    reward_min DECIMAL(12,2) NOT NULL,
    reward_max DECIMAL(12,2) NOT NULL,
    revealed_amount DECIMAL(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revealed_at TIMESTAMPTZ
);

CREATE INDEX idx_scratch_cards_buyer_status ON order_scratch_cards(buyer_id, status, created_at DESC);
