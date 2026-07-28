CREATE TABLE master_item_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_item_id  UUID NOT NULL REFERENCES master_items(id) ON DELETE CASCADE,
    media_id        UUID NOT NULL,
    public_url      VARCHAR(500) NOT NULL,
    sort_order      SMALLINT NOT NULL CHECK (sort_order BETWEEN 0 AND 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_master_item_images_slot UNIQUE (master_item_id, sort_order)
);

CREATE INDEX idx_master_item_images_master ON master_item_images (master_item_id);
