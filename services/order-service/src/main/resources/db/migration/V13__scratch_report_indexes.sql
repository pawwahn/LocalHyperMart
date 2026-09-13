CREATE INDEX IF NOT EXISTS idx_scratch_cards_created_town
    ON order_scratch_cards (created_at, town_id);

CREATE INDEX IF NOT EXISTS idx_scratch_cards_revealed
    ON order_scratch_cards (status, revealed_at, town_id);

CREATE INDEX IF NOT EXISTS idx_scratch_cards_status_town
    ON order_scratch_cards (status, town_id);
