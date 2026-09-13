CREATE TABLE buyer_memberships (
    id UUID PRIMARY KEY,
    buyer_id UUID NOT NULL UNIQUE,
    buyer_phone_snapshot VARCHAR(15),
    last_slab VARCHAR(20) NOT NULL,
    credits_remaining INTEGER NOT NULL DEFAULT 0,
    credits_granted_total INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_buyer_memberships_expires ON buyer_memberships (expires_at);

CREATE TABLE buyer_membership_purchases (
    id UUID PRIMARY KEY,
    buyer_id UUID NOT NULL,
    buyer_phone_snapshot VARCHAR(15),
    town_id UUID,
    slab VARCHAR(20) NOT NULL,
    duration_months INTEGER NOT NULL,
    credits_granted INTEGER NOT NULL,
    price_snapshot DECIMAL(12, 2) NOT NULL,
    payment_channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    paid_at TIMESTAMPTZ,
    confirmed_by UUID,
    expires_at_after TIMESTAMPTZ,
    note VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_bmp_buyer ON buyer_membership_purchases (buyer_id, created_at DESC);
CREATE INDEX idx_bmp_status ON buyer_membership_purchases (status, created_at DESC);
CREATE INDEX idx_bmp_paid ON buyer_membership_purchases (paid_at);

CREATE TABLE buyer_membership_ledger (
    id UUID PRIMARY KEY,
    buyer_id UUID NOT NULL,
    membership_id UUID NOT NULL REFERENCES buyer_memberships (id),
    purchase_id UUID,
    order_id UUID,
    entry_type VARCHAR(20) NOT NULL,
    credits_delta INTEGER NOT NULL,
    delivery_fee_waived DECIMAL(12, 2),
    note VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    updated_by UUID
);

CREATE UNIQUE INDEX uq_bml_order_type ON buyer_membership_ledger (order_id, entry_type)
    WHERE order_id IS NOT NULL;
CREATE INDEX idx_bml_buyer ON buyer_membership_ledger (buyer_id, created_at DESC);
CREATE INDEX idx_bml_type ON buyer_membership_ledger (entry_type, created_at DESC);
