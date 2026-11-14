CREATE TABLE hub_franchise_waivers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id       UUID NOT NULL,
    hub_id        UUID NOT NULL,
    period_start  DATE NOT NULL,
    period_end    DATE NOT NULL,
    reason        VARCHAR(500),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    UUID,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by    UUID,
    CONSTRAINT uq_hub_franchise_waiver_hub_month UNIQUE (hub_id, period_start)
);

CREATE INDEX idx_hub_franchise_waiver_town ON hub_franchise_waivers(town_id, period_start);
