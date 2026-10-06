CREATE TABLE razorpay_settlement_batches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_date     DATE NOT NULL,
    utr_reference       VARCHAR(120) NOT NULL,
    gross_amount        DECIMAL(12, 2) NOT NULL,
    fee_amount          DECIMAL(12, 2) NOT NULL DEFAULT 0,
    net_amount          DECIMAL(12, 2) NOT NULL,
    payment_count       INTEGER,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT chk_rzp_settlement_net CHECK (net_amount >= 0),
    CONSTRAINT uq_rzp_settlement_utr UNIQUE (utr_reference)
);

CREATE INDEX idx_rzp_settlement_date ON razorpay_settlement_batches (settlement_date DESC);
