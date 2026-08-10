-- Town-scoped sponsored ads (super-admin only). Exactly two slots per town: HOME_HERO, HOME_MID_GRID.
CREATE TABLE town_ads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id         UUID NOT NULL REFERENCES towns (id) ON DELETE CASCADE,
    slot            VARCHAR(40) NOT NULL,
    shop_name       VARCHAR(120) NOT NULL DEFAULT '',
    headline        VARCHAR(160) NOT NULL DEFAULT '',
    body_text       VARCHAR(240) NOT NULL DEFAULT '',
    cta_label       VARCHAR(60) NOT NULL DEFAULT 'Shop now',
    image_url       TEXT,
    image_media_id  UUID,
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID,
    updated_by      UUID,
    CONSTRAINT uq_town_ads_town_slot UNIQUE (town_id, slot),
    CONSTRAINT chk_town_ads_slot CHECK (slot IN ('HOME_HERO', 'HOME_MID_GRID'))
);

CREATE INDEX idx_town_ads_town ON town_ads (town_id);
CREATE INDEX idx_town_ads_enabled ON town_ads (town_id, enabled) WHERE enabled = TRUE;
