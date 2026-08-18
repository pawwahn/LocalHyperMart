-- Exception-only town visibility. Default follows categories.status (ACTIVE = live
-- in every town, including towns launched later). No backfill when adding towns.

CREATE TABLE category_town_overrides (
    category_id UUID NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    town_id     UUID NOT NULL,
    visible     BOOLEAN NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (category_id, town_id)
);

CREATE INDEX idx_category_town_overrides_town
    ON category_town_overrides (town_id, visible);

CREATE INDEX idx_category_town_overrides_category
    ON category_town_overrides (category_id, visible);
