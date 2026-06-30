CREATE TABLE idempotency_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key   VARCHAR(128) NOT NULL UNIQUE,
    user_id           UUID,
    resource_type     VARCHAR(50),
    resource_id       UUID,
    response_snapshot JSONB NOT NULL,
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_idempotency_expires ON idempotency_records(expires_at);
