ALTER TABLE food_profiles
    ADD COLUMN IF NOT EXISTS hotel_photo_media_ids VARCHAR(600) NOT NULL DEFAULT '[]';

COMMENT ON COLUMN food_profiles.hotel_photo_media_ids IS
    'JSON array of media UUIDs — storefront / ambience photos shown to buyers on food discovery.';