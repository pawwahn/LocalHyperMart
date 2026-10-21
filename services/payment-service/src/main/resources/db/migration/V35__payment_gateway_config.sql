CREATE TABLE payment_gateway_config (
    gateway VARCHAR(30) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    client_id VARCHAR(200),
    client_secret VARCHAR(500),
    client_version VARCHAR(40),
    webhook_secret VARCHAR(500),
    webhook_username VARCHAR(120),
    webhook_password VARCHAR(500),
    environment VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    updated_by UUID
);
