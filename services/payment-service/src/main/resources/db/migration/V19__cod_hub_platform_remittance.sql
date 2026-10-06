CREATE TABLE cod_hub_platform_remittances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id             UUID NOT NULL,
    hub_id              UUID NOT NULL,
    remittance_date     DATE NOT NULL,
    amount              DECIMAL(12,2) NOT NULL,
    reference           VARCHAR(120),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT chk_cod_hub_remittance_amount CHECK (amount > 0)
);

CREATE INDEX idx_cod_hub_remittance_hub_date ON cod_hub_platform_remittances(hub_id, remittance_date DESC);
