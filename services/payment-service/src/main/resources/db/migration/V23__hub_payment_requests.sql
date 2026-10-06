CREATE TABLE hub_payment_requests (
    id                  UUID PRIMARY KEY,
    town_id             UUID NOT NULL,
    hub_id              UUID NOT NULL,
    request_type        VARCHAR(16) NOT NULL,
    period_kind         VARCHAR(16) NOT NULL,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    total_amount        DECIMAL(12, 2) NOT NULL,
    franchise_label     VARCHAR(255),
    status              VARCHAR(24) NOT NULL DEFAULT 'ISSUED',
    submission_id       UUID REFERENCES hub_platform_payment_submissions (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT chk_hub_payment_request_type CHECK (request_type IN ('COD', 'FRANCHISE')),
    CONSTRAINT chk_hub_payment_request_period CHECK (period_kind IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
    CONSTRAINT chk_hub_payment_request_status CHECK (
        status IN ('ISSUED', 'PAYMENT_PENDING', 'APPROVED', 'CANCELLED')
    ),
    CONSTRAINT chk_hub_payment_request_amount CHECK (total_amount > 0),
    CONSTRAINT chk_hub_payment_request_dates CHECK (period_end >= period_start)
);

CREATE INDEX idx_hub_payment_req_hub_type_status
    ON hub_payment_requests (hub_id, request_type, status, created_at DESC);

CREATE INDEX idx_hub_payment_req_town_hub
    ON hub_payment_requests (town_id, hub_id, created_at DESC);

CREATE TABLE hub_payment_request_cod_lines (
    id              UUID PRIMARY KEY,
    request_id      UUID NOT NULL REFERENCES hub_payment_requests (id) ON DELETE CASCADE,
    order_id        UUID NOT NULL,
    order_number    VARCHAR(50),
    close_date      DATE,
    amount          DECIMAL(12, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID,
    updated_by      UUID,
    CONSTRAINT chk_hub_payment_cod_line_amount CHECK (amount > 0),
    CONSTRAINT uq_hub_payment_cod_line_request_order UNIQUE (request_id, order_id)
);

CREATE INDEX idx_hub_payment_cod_line_request ON hub_payment_request_cod_lines (request_id);
CREATE INDEX idx_hub_payment_cod_line_order ON hub_payment_request_cod_lines (order_id);

ALTER TABLE hub_platform_payment_submissions
    ADD COLUMN payment_request_id UUID REFERENCES hub_payment_requests (id);

CREATE INDEX idx_hub_pay_submission_request ON hub_platform_payment_submissions (payment_request_id);
