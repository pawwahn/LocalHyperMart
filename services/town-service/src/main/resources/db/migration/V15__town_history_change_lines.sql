ALTER TABLE town_history
    ADD COLUMN IF NOT EXISTS change_lines JSONB;
