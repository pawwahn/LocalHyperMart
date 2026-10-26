ALTER TABLE beauty_orders
    ADD COLUMN reference_photo_media_id UUID;

CREATE UNIQUE INDEX uq_beauty_reference_photo
    ON beauty_orders (reference_photo_media_id)
    WHERE reference_photo_media_id IS NOT NULL;
