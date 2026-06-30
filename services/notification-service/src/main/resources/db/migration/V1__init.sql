CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE notification_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code      VARCHAR(80) NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    language        VARCHAR(10) NOT NULL DEFAULT 'en',
    subject         VARCHAR(255),
    body_template   TEXT NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID,
    UNIQUE (event_code, channel, language)
);

CREATE TABLE notification_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id             UUID,
    order_id            UUID,
    recipient_user_id   UUID,
    recipient_phone     VARCHAR(15),
    channel             VARCHAR(20) NOT NULL,
    event_code          VARCHAR(80) NOT NULL,
    body                TEXT,
    status              VARCHAR(30) NOT NULL,
    skip_reason         VARCHAR(100),
    provider_ref        VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_order ON notification_logs(order_id);
CREATE INDEX idx_notification_logs_recipient ON notification_logs(recipient_user_id);
CREATE INDEX idx_notification_logs_created ON notification_logs(created_at DESC);
