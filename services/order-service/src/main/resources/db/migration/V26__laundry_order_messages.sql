CREATE TABLE IF NOT EXISTS laundry_order_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES laundry_orders(id) ON DELETE CASCADE,
    sender_role VARCHAR(10) NOT NULL,
    body        VARCHAR(400) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID,
    updated_by  UUID
);

CREATE INDEX IF NOT EXISTS idx_laundry_order_messages_order
    ON laundry_order_messages (order_id, created_at);
