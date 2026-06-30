CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE daily_order_sequences (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id        UUID NOT NULL,
    order_date     DATE NOT NULL,
    last_sequence  INT NOT NULL DEFAULT 0,
    UNIQUE (town_id, order_date)
);

CREATE TABLE orders (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number              VARCHAR(40) NOT NULL UNIQUE,
    town_id                   UUID NOT NULL,
    buyer_id                  UUID NOT NULL,
    cart_id                   UUID,
    status                    VARCHAR(40) NOT NULL,
    payment_method            VARCHAR(20),
    payment_status            VARCHAR(30),
    currency                  VARCHAR(3) NOT NULL DEFAULT 'INR',
    items_subtotal            DECIMAL(12,2) NOT NULL,
    delivery_fee              DECIMAL(12,2) NOT NULL DEFAULT 0,
    platform_fee              DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount                DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount              DECIMAL(12,2) NOT NULL,
    fee_rule_snapshot_id      UUID,
    delivery_address_snapshot JSONB NOT NULL,
    buyer_phone_snapshot      VARCHAR(15),
    version                   INT NOT NULL DEFAULT 0,
    placed_at                 TIMESTAMPTZ,
    ready_for_delivery_at     TIMESTAMPTZ,
    out_for_delivery_at       TIMESTAMPTZ,
    delivered_at              TIMESTAMPTZ,
    cancelled_at              TIMESTAMPTZ,
    cancel_reason             TEXT,
    buyer_rejected_reason     TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by                UUID,
    updated_by                UUID
);

CREATE TABLE vendor_sub_orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              UUID NOT NULL REFERENCES orders(id),
    vendor_id             UUID NOT NULL,
    shop_id               UUID NOT NULL,
    status                VARCHAR(40) NOT NULL,
    subtotal              DECIMAL(12,2) NOT NULL,
    reject_reason         TEXT,
    ready_for_pickup_at   TIMESTAMPTZ,
    picked_from_vendor_at TIMESTAMPTZ,
    brought_to_hub_at     TIMESTAMPTZ,
    version               INT NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by            UUID,
    updated_by            UUID
);

CREATE TABLE order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_sub_order_id UUID NOT NULL REFERENCES vendor_sub_orders(id),
    listing_id          UUID NOT NULL,
    master_item_id      UUID NOT NULL,
    item_name_snapshot  VARCHAR(255) NOT NULL,
    unit_code_snapshot  VARCHAR(20),
    shop_name_snapshot  VARCHAR(255),
    quantity            INT NOT NULL,
    unit_price          DECIMAL(12,2) NOT NULL,
    discount_price      DECIMAL(12,2),
    line_total          DECIMAL(12,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_status_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID REFERENCES orders(id),
    vendor_sub_order_id UUID,
    from_status         VARCHAR(40),
    to_status           VARCHAR(40) NOT NULL,
    changed_by          UUID,
    changed_by_role     VARCHAR(50),
    note                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE outbox_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id       UUID NOT NULL,
    aggregate_id   UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    payload        JSONB NOT NULL,
    status         VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at   TIMESTAMPTZ
);

CREATE TABLE processed_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID NOT NULL UNIQUE,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_town ON orders(town_id);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_vendor_sub_orders_order ON vendor_sub_orders(order_id);
CREATE INDEX idx_outbox_status ON outbox_events(status, created_at);
