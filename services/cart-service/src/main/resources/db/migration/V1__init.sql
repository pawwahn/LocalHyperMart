CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE carts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    town_id     UUID NOT NULL,
    status      VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID,
    updated_by  UUID
);

CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id         UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    listing_id      UUID NOT NULL,
    vendor_id       UUID NOT NULL,
    master_item_id  UUID NOT NULL,
    item_name       VARCHAR(255) NOT NULL,
    shop_id         UUID NOT NULL,
    quantity        INT NOT NULL CHECK (quantity > 0),
    unit_price      DECIMAL(12,2) NOT NULL,
    discount_price  DECIMAL(12,2),
    line_total      DECIMAL(12,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID,
    UNIQUE (cart_id, listing_id)
);

CREATE UNIQUE INDEX idx_carts_user_town_active ON carts(user_id, town_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_carts_user ON carts(user_id);
CREATE INDEX idx_carts_town ON carts(town_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
