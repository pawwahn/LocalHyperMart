CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE towns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(150) NOT NULL,
    state               VARCHAR(100) NOT NULL,
    town_code           VARCHAR(10)  NOT NULL,
    state_code          VARCHAR(10)  NOT NULL,
    display_name        VARCHAR(200) NOT NULL,
    coverage_radius_km  DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    status              VARCHAR(30)  NOT NULL DEFAULT 'ENABLED',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    UNIQUE (name, state),
    UNIQUE (town_code, state_code)
);

CREATE TABLE town_pincodes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id    UUID NOT NULL REFERENCES towns(id),
    pincode    VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (town_id, pincode)
);

CREATE TABLE town_config (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id        UUID NOT NULL REFERENCES towns(id),
    config_key     VARCHAR(100) NOT NULL,
    config_value   JSONB NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     UUID,
    updated_by     UUID
);

CREATE TABLE order_status_labels (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id          UUID,
    internal_code    VARCHAR(60) NOT NULL,
    display_label    VARCHAR(100) NOT NULL,
    visible_to_buyer BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order       INT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE town_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id             UUID NOT NULL,
    actor_user_id       UUID NOT NULL,
    actor_role          VARCHAR(50),
    on_behalf_of_hub_id UUID,
    action              VARCHAR(100) NOT NULL,
    entity_type         VARCHAR(100),
    entity_id           UUID,
    before_snapshot     JSONB,
    after_snapshot      JSONB,
    correlation_id      UUID,
    ip_address          VARCHAR(45),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE on_behalf_sessions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    super_admin_user_id  UUID NOT NULL,
    hub_id               UUID NOT NULL,
    town_id              UUID NOT NULL,
    started_at           TIMESTAMPTZ NOT NULL,
    expires_at           TIMESTAMPTZ NOT NULL,
    ended_at             TIMESTAMPTZ
);

CREATE TABLE platform_settings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key   VARCHAR(100) NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_towns_status ON towns(status);
CREATE INDEX idx_town_history_town ON town_history(town_id, created_at DESC);

INSERT INTO order_status_labels (town_id, internal_code, display_label, visible_to_buyer, sort_order) VALUES
    (NULL, 'PLACED', 'Order Placed', TRUE, 1),
    (NULL, 'PAYMENT_FAILED', 'Payment Failed', TRUE, 2),
    (NULL, 'READY_FOR_PICKUP', 'Being Prepared', TRUE, 3),
    (NULL, 'READY_FOR_DELIVERY', 'At Delivery Hub', TRUE, 4),
    (NULL, 'PICKED_FROM_DELIVERY_HUB', 'Out for Delivery', TRUE, 5),
    (NULL, 'DELIVERED', 'Delivered', TRUE, 6),
    (NULL, 'VENDOR_REJECTED', 'Cancelled', TRUE, 7),
    (NULL, 'BUYER_REJECTED', 'Delivery Refused', TRUE, 8);
