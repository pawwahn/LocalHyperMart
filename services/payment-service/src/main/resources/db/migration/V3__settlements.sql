CREATE TABLE settlements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id                 UUID NOT NULL,
    payee_type              VARCHAR(20) NOT NULL,
    payee_id                UUID NOT NULL,
    payee_name              VARCHAR(255),
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    period_type             VARCHAR(20) NOT NULL DEFAULT 'CUSTOM',
    gross_amount            DECIMAL(12,2) NOT NULL,
    commission_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_amount              DECIMAL(12,2) NOT NULL,
    status                  VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    payout_method           VARCHAR(40),
    transaction_reference   VARCHAR(255),
    transaction_notes       TEXT,
    paid_at                 TIMESTAMPTZ,
    paid_by                 UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    updated_by              UUID
);

CREATE TABLE settlement_line_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id       UUID NOT NULL REFERENCES settlements(id),
    order_id            UUID NOT NULL,
    sub_order_id        UUID NOT NULL,
    order_number        VARCHAR(50),
    sub_order_number    VARCHAR(50),
    line_type           VARCHAR(30) NOT NULL DEFAULT 'ORDER',
    amount              DECIMAL(12,2) NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT uq_settlement_line_sub_order UNIQUE (sub_order_id)
);

CREATE INDEX idx_settlements_town ON settlements(town_id);
CREATE INDEX idx_settlements_payee ON settlements(payee_type, payee_id);
CREATE INDEX idx_settlements_period ON settlements(period_end);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlement_lines_settlement ON settlement_line_items(settlement_id);
CREATE INDEX idx_settlement_lines_order ON settlement_line_items(order_id);
