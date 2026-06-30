CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE units (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20) NOT NULL UNIQUE,
    label       VARCHAR(50) NOT NULL,
    status      VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID,
    updated_by  UUID
);

CREATE TABLE categories (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    image_media_id   UUID,
    status           VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID,
    updated_by       UUID
);

CREATE TABLE master_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id      UUID NOT NULL REFERENCES categories(id),
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    unit_id          UUID NOT NULL REFERENCES units(id),
    mrp              DECIMAL(12,2),
    image_media_id   UUID,
    status           VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID,
    updated_by       UUID
);

CREATE TABLE vendor_listings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id          UUID NOT NULL,
    vendor_id        UUID NOT NULL,
    shop_id          UUID NOT NULL,
    master_item_id   UUID NOT NULL REFERENCES master_items(id),
    price            DECIMAL(12,2) NOT NULL,
    discount_price   DECIMAL(12,2),
    vendor_note      VARCHAR(500),
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    price_updated_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID,
    updated_by       UUID,
    UNIQUE (vendor_id, master_item_id)
);

CREATE INDEX idx_master_items_category ON master_items(category_id);
CREATE INDEX idx_master_items_name ON master_items(name);
CREATE INDEX idx_master_items_status ON master_items(status);
CREATE INDEX idx_vendor_listings_town ON vendor_listings(town_id);
CREATE INDEX idx_vendor_listings_town_active ON vendor_listings(town_id, active);
CREATE INDEX idx_vendor_listings_vendor ON vendor_listings(vendor_id);
CREATE INDEX idx_vendor_listings_master_item ON vendor_listings(master_item_id);
