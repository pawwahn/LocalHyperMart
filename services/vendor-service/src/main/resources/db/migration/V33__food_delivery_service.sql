INSERT INTO vendor_services (id, name, hides_listings, sort_order)
SELECT 'a5555555-5555-4555-8555-555555555555', 'Food Delivery', TRUE, 5
WHERE NOT EXISTS (
    SELECT 1 FROM vendor_services
    WHERE id = 'a5555555-5555-4555-8555-555555555555'
       OR lower(name) = lower('Food Delivery')
);

CREATE TABLE food_profiles (
    vendor_id           UUID PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    tagline             VARCHAR(200),
    cuisines            VARCHAR(300),
    pure_veg            BOOLEAN NOT NULL DEFAULT FALSE,
    opens_at_label      VARCHAR(40),
    price_for_one       NUMERIC(12, 2),
    offer_label         VARCHAR(80),
    rating_score        NUMERIC(3, 2) NOT NULL DEFAULT 0,
    rating_count        INT NOT NULL DEFAULT 0,
    accepting_orders    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT chk_food_price_for_one CHECK (price_for_one IS NULL OR price_for_one >= 0),
    CONSTRAINT chk_food_rating CHECK (rating_score >= 0 AND rating_score <= 5)
);