-- Mandatory customer-facing note; veg/non-veg is explicit per item (veg column, no default ambiguity in API).
ALTER TABLE food_menu_items
    ADD COLUMN IF NOT EXISTS buyer_note VARCHAR(500);

UPDATE food_menu_items
SET buyer_note = COALESCE(NULLIF(TRIM(description), ''), 'See hotel for ingredients.')
WHERE buyer_note IS NULL OR TRIM(buyer_note) = '';

ALTER TABLE food_menu_items
    ALTER COLUMN buyer_note SET NOT NULL;