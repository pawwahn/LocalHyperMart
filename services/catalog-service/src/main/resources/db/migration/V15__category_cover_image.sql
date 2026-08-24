-- Cover photo for buyer category tiles. image_media_id already exists on categories.
ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
