CREATE TABLE vendor_listing_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      UUID NOT NULL REFERENCES vendor_listings(id) ON DELETE CASCADE,
    media_id        UUID NOT NULL,
    public_url      VARCHAR(500) NOT NULL,
    sort_order      SMALLINT NOT NULL CHECK (sort_order BETWEEN 0 AND 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_listing_images_slot UNIQUE (listing_id, sort_order)
);

CREATE INDEX idx_vendor_listing_images_listing ON vendor_listing_images (listing_id);
