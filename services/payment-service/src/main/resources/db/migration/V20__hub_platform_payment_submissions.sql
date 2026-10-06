CREATE TABLE hub_platform_payment_submissions (
    id                  UUID PRIMARY KEY,
    town_id             UUID NOT NULL,
    hub_id              UUID NOT NULL,
    payment_date        DATE NOT NULL,
    total_amount        DECIMAL(12, 2) NOT NULL,
    payment_reference   VARCHAR(120) NOT NULL,
    hub_notes           TEXT,
    status              VARCHAR(32) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    admin_notes         TEXT,
    verified_at         TIMESTAMPTZ,
    verified_by         UUID,
    rejected_at         TIMESTAMPTZ,
    rejected_by         UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT chk_hub_pay_submission_amount CHECK (total_amount > 0),
    CONSTRAINT chk_hub_pay_submission_status CHECK (
        status IN ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')
    )
);

CREATE INDEX idx_hub_pay_submission_hub_status ON hub_platform_payment_submissions (hub_id, status, created_at DESC);

CREATE TABLE hub_platform_payment_submission_lines (
    id                      UUID PRIMARY KEY,
    submission_id           UUID NOT NULL REFERENCES hub_platform_payment_submissions (id) ON DELETE CASCADE,
    line_type               VARCHAR(32) NOT NULL,
    amount                  DECIMAL(12, 2) NOT NULL,
    franchise_period_start  DATE,
    franchise_period_end    DATE,
    franchise_label         VARCHAR(255),
    cod_remittance_id       UUID,
    franchise_settlement_id UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID,
    updated_by              UUID,
    CONSTRAINT chk_hub_pay_line_type CHECK (line_type IN ('COD_REMITTANCE', 'FRANCHISE_FEE')),
    CONSTRAINT chk_hub_pay_line_amount CHECK (amount > 0)
);

CREATE INDEX idx_hub_pay_line_submission ON hub_platform_payment_submission_lines (submission_id);

ALTER TABLE cod_hub_platform_remittances
    ADD COLUMN submission_id UUID REFERENCES hub_platform_payment_submissions (id);

CREATE INDEX idx_cod_hub_remittance_submission ON cod_hub_platform_remittances (submission_id);
