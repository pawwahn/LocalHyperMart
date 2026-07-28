CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE media_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_name   VARCHAR(255) NOT NULL,
    content_type    VARCHAR(100) NOT NULL,
    size_bytes      BIGINT NOT NULL,
    storage_path    VARCHAR(500) NOT NULL,
    context         VARCHAR(40) NOT NULL,
    owner_user_id   UUID,
    public_url      VARCHAR(500) NOT NULL,
    scan_status     VARCHAR(30) NOT NULL DEFAULT 'CLEAN',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_files_context ON media_files (context);
