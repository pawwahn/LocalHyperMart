CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE delivery_hubs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id     UUID NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    address     TEXT,
    phone       VARCHAR(15),
    status      VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID,
    updated_by  UUID
);

CREATE TABLE hub_admins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_id      UUID NOT NULL REFERENCES delivery_hubs(id),
    user_id     UUID NOT NULL,
    pin_hash    VARCHAR(255),
    status      VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID,
    updated_by  UUID,
    UNIQUE (hub_id)
);

CREATE INDEX idx_hub_admins_user ON hub_admins(user_id);

CREATE TABLE delivery_agents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(15) NOT NULL,
    status      VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    disabled_by UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID,
    updated_by  UUID
);

CREATE INDEX idx_delivery_agents_user ON delivery_agents(user_id);
CREATE INDEX idx_delivery_agents_phone ON delivery_agents(phone);
CREATE INDEX idx_delivery_agents_status ON delivery_agents(status);

CREATE TABLE agent_hub_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID NOT NULL REFERENCES delivery_agents(id),
    hub_id      UUID NOT NULL REFERENCES delivery_hubs(id),
    town_id     UUID NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID,
    updated_by  UUID,
    UNIQUE (agent_id, hub_id)
);

CREATE TABLE delivery_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL,
    vendor_sub_order_id UUID,
    town_id             UUID NOT NULL,
    hub_id              UUID NOT NULL REFERENCES delivery_hubs(id),
    agent_id            UUID NOT NULL REFERENCES delivery_agents(id),
    leg_type            VARCHAR(20) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',
    assigned_by         UUID,
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

CREATE INDEX idx_delivery_assignments_order ON delivery_assignments(order_id);
CREATE INDEX idx_delivery_assignments_sub_order ON delivery_assignments(vendor_sub_order_id);
CREATE INDEX idx_delivery_assignments_agent ON delivery_assignments(agent_id);
CREATE INDEX idx_delivery_assignments_status ON delivery_assignments(status);
CREATE INDEX idx_delivery_assignments_leg ON delivery_assignments(leg_type);

CREATE TABLE delivery_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES delivery_assignments(id),
    event_type      VARCHAR(50) NOT NULL,
    metadata        JSONB,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_events_assignment ON delivery_events(assignment_id);
