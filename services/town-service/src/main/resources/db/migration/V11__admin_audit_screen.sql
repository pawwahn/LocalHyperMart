ALTER TABLE town_history
    ALTER COLUMN town_id DROP NOT NULL;

ALTER TABLE town_history
    ADD COLUMN IF NOT EXISTS screen_key VARCHAR(50);

ALTER TABLE town_history
    ADD COLUMN IF NOT EXISTS change_summary VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_town_history_screen_created
    ON town_history (screen_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_town_history_town_created
    ON town_history (town_id, created_at DESC);
