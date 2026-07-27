CREATE TABLE cod_close_days (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id             UUID NOT NULL,
    hub_id              UUID NOT NULL,
    agent_id            UUID NOT NULL,
    close_date          DATE NOT NULL,
    expected_amount     DECIMAL(12,2) NOT NULL,
    received_amount     DECIMAL(12,2) NOT NULL,
    order_count         INT NOT NULL DEFAULT 0,
    status              VARCHAR(30) NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

CREATE TABLE cod_close_day_line_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_day_id        UUID NOT NULL REFERENCES cod_close_days(id),
    order_id            UUID NOT NULL,
    order_number        VARCHAR(50),
    amount              DECIMAL(12,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT uq_cod_close_day_line_order UNIQUE (order_id)
);

CREATE INDEX idx_cod_close_days_town_hub_date ON cod_close_days(town_id, hub_id, close_date);
CREATE INDEX idx_cod_close_days_agent_date ON cod_close_days(agent_id, close_date);
CREATE INDEX idx_cod_close_days_status ON cod_close_days(status);
CREATE INDEX idx_cod_close_day_lines_close_day ON cod_close_day_line_items(close_day_id);
