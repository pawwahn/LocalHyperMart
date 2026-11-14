-- Food delivery: vendor menu (category → items) with listing bridge for grocery checkout.
INSERT INTO categories (id, name, description, status)
SELECT 'f0c00000-0000-4000-8000-000000000099'::uuid,
       'Food menu (system)',
       'Internal master-items bucket for hotel dishes — hidden from grocery browse',
       'PAUSED'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'f0c00000-0000-4000-8000-000000000099'::uuid);

ALTER TABLE vendor_listings
    ADD COLUMN IF NOT EXISTS listing_kind VARCHAR(20) NOT NULL DEFAULT 'GROCERY';

ALTER TABLE vendor_listings
    ADD CONSTRAINT vendor_listings_kind_chk CHECK (listing_kind IN ('GROCERY', 'FOOD_MENU'));

CREATE TABLE food_menu_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL,
    name            VARCHAR(120) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID
);

CREATE UNIQUE INDEX uq_food_menu_category_name ON food_menu_categories (vendor_id, lower(name));
CREATE INDEX idx_food_menu_categories_vendor ON food_menu_categories(vendor_id, sort_order);

CREATE TABLE food_menu_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL,
    category_id         UUID NOT NULL REFERENCES food_menu_categories(id) ON DELETE CASCADE,
    name                VARCHAR(200) NOT NULL,
    description         VARCHAR(500),
    price               NUMERIC(12, 2) NOT NULL,
    veg                 BOOLEAN NOT NULL DEFAULT TRUE,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL DEFAULT 0,
    master_item_id      UUID REFERENCES master_items(id),
    vendor_listing_id   UUID REFERENCES vendor_listings(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT chk_food_menu_price CHECK (price > 0)
);

CREATE INDEX idx_food_menu_items_category ON food_menu_items(category_id, sort_order);
CREATE INDEX idx_food_menu_items_vendor ON food_menu_items(vendor_id);
CREATE INDEX idx_food_menu_items_listing ON food_menu_items(vendor_listing_id);