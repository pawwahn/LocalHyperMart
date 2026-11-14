ALTER TABLE diagnostics_orders
    ADD COLUMN IF NOT EXISTS sample_photo_media_ids VARCHAR(400);
