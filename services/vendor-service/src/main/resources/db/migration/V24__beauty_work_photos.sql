ALTER TABLE beauty_profiles
    ADD COLUMN IF NOT EXISTS work_photo_media_ids VARCHAR(600) NOT NULL DEFAULT '[]';

COMMENT ON COLUMN beauty_profiles.work_photo_media_ids IS
    'JSON array of up to 10 media UUIDs for glam portfolio (Our work).';
