-- Claim credits must reduce future vendor payouts (chargebacks).
CREATE TABLE vendor_settlement_adjustments (
    id                      UUID PRIMARY KEY,
    town_id                 UUID NOT NULL,
    vendor_id               UUID NOT NULL,
    shop_id                 UUID,
    claim_id                UUID NOT NULL,
    order_id                UUID NOT NULL,
    order_item_id           UUID NOT NULL,
    sub_order_id            UUID NOT NULL,
    amount                  DECIMAL(12,2) NOT NULL,
    reason                  TEXT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    applied_settlement_id   UUID REFERENCES settlements(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_settlement_adj_claim UNIQUE (claim_id),
    CONSTRAINT chk_vendor_settlement_adj_amount CHECK (amount > 0),
    CONSTRAINT chk_vendor_settlement_adj_status CHECK (status IN ('PENDING', 'APPLIED'))
);

CREATE INDEX idx_vendor_settlement_adj_pending
    ON vendor_settlement_adjustments(vendor_id, town_id, status);

CREATE INDEX idx_vendor_settlement_adj_sub_order
    ON vendor_settlement_adjustments(sub_order_id);

-- Allow multiple ADJUSTMENT lines per sub-order; keep one ORDER line only.
ALTER TABLE settlement_line_items DROP CONSTRAINT IF EXISTS uq_settlement_line_sub_order;
CREATE UNIQUE INDEX uq_settlement_line_order_sub_order
    ON settlement_line_items(sub_order_id)
    WHERE line_type = 'ORDER';
