-- Up to 3 images per town ad (JSON array of {url, mediaId}).
ALTER TABLE town_ads
    ADD COLUMN images_json TEXT NOT NULL DEFAULT '[]';

UPDATE town_ads
SET images_json = CASE
    WHEN image_url IS NOT NULL AND btrim(image_url) <> '' THEN
        json_build_array(
            json_build_object(
                'url', image_url,
                'mediaId', CASE WHEN image_media_id IS NULL THEN NULL ELSE image_media_id::text END
            )
        )::text
    ELSE '[]'
END
WHERE images_json = '[]' OR images_json IS NULL;
