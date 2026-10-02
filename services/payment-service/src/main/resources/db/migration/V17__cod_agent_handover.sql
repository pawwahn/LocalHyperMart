ALTER TABLE cod_close_days
    ADD COLUMN IF NOT EXISTS custodian_type VARCHAR(20) NOT NULL DEFAULT 'HUB',
    ADD COLUMN IF NOT EXISTS vendor_id UUID,
    ADD COLUMN IF NOT EXISTS agent_handover_id UUID;

ALTER TABLE cod_close_days ALTER COLUMN hub_id DROP NOT NULL;

CREATE TABLE cod_agent_handovers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id             UUID NOT NULL,
    agent_id            UUID NOT NULL,
    agent_user_id       UUID NOT NULL,
    custodian_type      VARCHAR(20) NOT NULL,
    hub_id              UUID,
    vendor_id           UUID,
    handover_date       DATE NOT NULL,
    declared_amount     DECIMAL(12,2) NOT NULL,
    status              VARCHAR(30) NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT chk_cod_handover_custodian CHECK (
        (custodian_type = 'HUB' AND hub_id IS NOT NULL)
        OR (custodian_type = 'VENDOR' AND vendor_id IS NOT NULL)
    )
);

CREATE TABLE cod_agent_handover_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id         UUID NOT NULL REFERENCES cod_agent_handovers(id) ON DELETE CASCADE,
    order_id            UUID NOT NULL,
    order_number        VARCHAR(50),
    collect_amount      DECIMAL(12,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT uq_cod_handover_line_order UNIQUE (order_id)
);

CREATE TABLE cod_agent_handover_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_line_id    UUID NOT NULL REFERENCES cod_agent_handover_lines(id) ON DELETE CASCADE,
    sub_order_id        UUID NOT NULL,
    vendor_id           UUID NOT NULL,
    sub_order_number    VARCHAR(50),
    goods_subtotal      DECIMAL(12,2) NOT NULL,
    allocated_cash      DECIMAL(12,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cod_close_day_allocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_day_line_id   UUID NOT NULL REFERENCES cod_close_day_line_items(id) ON DELETE CASCADE,
    sub_order_id        UUID NOT NULL,
    vendor_id           UUID NOT NULL,
    sub_order_number    VARCHAR(50),
    goods_subtotal      DECIMAL(12,2) NOT NULL,
    allocated_cash      DECIMAL(12,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cod_handovers_agent_date ON cod_agent_handovers(agent_id, handover_date);
CREATE INDEX idx_cod_handovers_status ON cod_agent_handovers(status);
CREATE INDEX idx_cod_handovers_custodian ON cod_agent_handovers(custodian_type, hub_id, vendor_id);
CREATE INDEX idx_cod_handover_lines_handover ON cod_agent_handover_lines(handover_id);
CREATE INDEX idx_cod_close_alloc_line ON cod_close_day_allocations(close_day_line_id);
