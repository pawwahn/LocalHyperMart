CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL,
    town_id             UUID NOT NULL,
    buyer_id            UUID NOT NULL,
    amount              DECIMAL(12,2) NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
    method              VARCHAR(30) NOT NULL DEFAULT 'UPI',
    gateway             VARCHAR(30) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    gateway_order_id    VARCHAR(255),
    gateway_payment_id  VARCHAR(255),
    idempotency_key     VARCHAR(128) UNIQUE,
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

CREATE TABLE payment_webhook_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway          VARCHAR(30) NOT NULL,
    payload          JSONB NOT NULL,
    signature_valid  BOOLEAN NOT NULL DEFAULT FALSE,
    processed        BOOLEAN NOT NULL DEFAULT FALSE,
    received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_buyer ON payments(buyer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payment_webhook_logs_gateway ON payment_webhook_logs(gateway, received_at DESC);
