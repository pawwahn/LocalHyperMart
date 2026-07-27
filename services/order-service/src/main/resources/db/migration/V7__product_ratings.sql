CREATE TABLE product_ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    order_item_id   UUID NOT NULL UNIQUE REFERENCES order_items(id),
    buyer_id        UUID NOT NULL,
    town_id         UUID NOT NULL,
    listing_id      UUID NOT NULL,
    master_item_id  UUID NOT NULL,
    stars           SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_ratings_listing ON product_ratings (listing_id);
CREATE INDEX idx_product_ratings_order ON product_ratings (order_id);
CREATE INDEX idx_product_ratings_buyer ON product_ratings (buyer_id, created_at DESC);
