-- Prevent duplicate category names (case-insensitive, trimmed).
-- Rename extra rows that already share a name so the unique index can apply.

UPDATE categories c
SET name = c.name || ' (' || substring(c.id::text, 1, 8) || ')'
WHERE c.id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY lower(btrim(name))
                   ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM categories
    ) ranked
    WHERE ranked.rn > 1
);

CREATE UNIQUE INDEX ux_categories_name_lower ON categories (lower(btrim(name)));
