-- Move all catalog items from legacy "Drinks" into "Cold Drinks and Juices", then delete Drinks.

DO $$
DECLARE
    drinks_id UUID;
    cold_id UUID;
    moved_count INTEGER;
BEGIN
    SELECT id INTO drinks_id
    FROM categories
    WHERE lower(btrim(name)) = 'drinks'
    LIMIT 1;

    IF drinks_id IS NULL THEN
        RETURN;
    END IF;

    SELECT id INTO cold_id
    FROM categories
    WHERE lower(btrim(name)) = 'cold drinks and juices'
    LIMIT 1;

    IF cold_id IS NULL THEN
        RAISE EXCEPTION 'Cold Drinks and Juices category not found — cannot merge Drinks';
    END IF;

    UPDATE master_items
    SET category_id = cold_id,
        updated_at = NOW()
    WHERE category_id = drinks_id;

    GET DIAGNOSTICS moved_count = ROW_COUNT;

    DELETE FROM categories WHERE id = drinks_id;

    RAISE NOTICE 'Merged % master item(s) from Drinks into Cold Drinks and Juices', moved_count;
END $$;
