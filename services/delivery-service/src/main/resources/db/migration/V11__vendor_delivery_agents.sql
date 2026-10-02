ALTER TABLE delivery_agents
    ADD COLUMN IF NOT EXISTS agent_type VARCHAR(20) NOT NULL DEFAULT 'HUB',
    ADD COLUMN IF NOT EXISTS vendor_id UUID,
    ADD COLUMN IF NOT EXISTS shop_id UUID;

CREATE TABLE IF NOT EXISTS agent_vendor_links (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id   UUID NOT NULL REFERENCES delivery_agents (id),
    vendor_id  UUID NOT NULL,
    shop_id    UUID NOT NULL,
    town_id    UUID NOT NULL,
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_vendor_links_agent_shop
    ON agent_vendor_links (agent_id, shop_id) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_agent_vendor_links_vendor
    ON agent_vendor_links (vendor_id, active);

ALTER TABLE delivery_assignments
    ALTER COLUMN hub_id DROP NOT NULL;
