-- Align denormalized settlement / claim order numbers with NRPT/AP-ddMMyy-0001.

UPDATE settlement_line_items
SET order_number = 'MIG|' || order_number
WHERE order_number ~ '^.+-[0-9]{6}-O?[0-9]+'
  AND order_number NOT LIKE 'MIG|%'
  AND (
      order_number ~ '-[0-9]{6}-O[0-9]'
      OR substring(order_number FROM '-([0-9]{2})[0-9]{4}-')::int BETWEEN 20 AND 29
  );

UPDATE settlement_line_items s
SET order_number = m.new_number
FROM (
    SELECT
        id,
        parts[1]
            || '-'
            || substr(parts[2], 5, 2) || substr(parts[2], 3, 2) || substr(parts[2], 1, 2)
            || '-'
            || lpad(regexp_replace(parts[3], '^O', ''), 4, '0')
            || COALESCE(parts[4], '') AS new_number
    FROM (
        SELECT
            id,
            regexp_match(substring(order_number FROM 5), '^(.+)-([0-9]{6})-(O?[0-9]+)(.*)$') AS parts
        FROM settlement_line_items
        WHERE order_number LIKE 'MIG|%'
    ) x
    WHERE parts IS NOT NULL
) m
WHERE s.id = m.id;

UPDATE settlement_line_items
SET sub_order_number = 'MIG|' || sub_order_number
WHERE sub_order_number ~ '^.+-[0-9]{6}-O?[0-9]+'
  AND sub_order_number NOT LIKE 'MIG|%'
  AND (
      sub_order_number ~ '-[0-9]{6}-O[0-9]'
      OR substring(sub_order_number FROM '-([0-9]{2})[0-9]{4}-')::int BETWEEN 20 AND 29
  );

UPDATE settlement_line_items s
SET sub_order_number = m.new_number
FROM (
    SELECT
        id,
        parts[1]
            || '-'
            || substr(parts[2], 5, 2) || substr(parts[2], 3, 2) || substr(parts[2], 1, 2)
            || '-'
            || lpad(regexp_replace(parts[3], '^O', ''), 4, '0')
            || COALESCE(parts[4], '') AS new_number
    FROM (
        SELECT
            id,
            regexp_match(substring(sub_order_number FROM 5), '^(.+)-([0-9]{6})-(O?[0-9]+)(.*)$') AS parts
        FROM settlement_line_items
        WHERE sub_order_number LIKE 'MIG|%'
    ) x
    WHERE parts IS NOT NULL
) m
WHERE s.id = m.id;

UPDATE vendor_settlement_adjustments
SET order_number = 'MIG|' || order_number
WHERE order_number ~ '^.+-[0-9]{6}-O?[0-9]+'
  AND order_number NOT LIKE 'MIG|%'
  AND (
      order_number ~ '-[0-9]{6}-O[0-9]'
      OR substring(order_number FROM '-([0-9]{2})[0-9]{4}-')::int BETWEEN 20 AND 29
  );

UPDATE vendor_settlement_adjustments a
SET order_number = m.new_number
FROM (
    SELECT
        id,
        parts[1]
            || '-'
            || substr(parts[2], 5, 2) || substr(parts[2], 3, 2) || substr(parts[2], 1, 2)
            || '-'
            || lpad(regexp_replace(parts[3], '^O', ''), 4, '0')
            || COALESCE(parts[4], '') AS new_number
    FROM (
        SELECT
            id,
            regexp_match(substring(order_number FROM 5), '^(.+)-([0-9]{6})-(O?[0-9]+)(.*)$') AS parts
        FROM vendor_settlement_adjustments
        WHERE order_number LIKE 'MIG|%'
    ) x
    WHERE parts IS NOT NULL
) m
WHERE a.id = m.id;

UPDATE cod_close_day_line_items
SET order_number = 'MIG|' || order_number
WHERE order_number ~ '^.+-[0-9]{6}-O?[0-9]+'
  AND order_number NOT LIKE 'MIG|%'
  AND (
      order_number ~ '-[0-9]{6}-O[0-9]'
      OR substring(order_number FROM '-([0-9]{2})[0-9]{4}-')::int BETWEEN 20 AND 29
  );

UPDATE cod_close_day_line_items c
SET order_number = m.new_number
FROM (
    SELECT
        id,
        parts[1]
            || '-'
            || substr(parts[2], 5, 2) || substr(parts[2], 3, 2) || substr(parts[2], 1, 2)
            || '-'
            || lpad(regexp_replace(parts[3], '^O', ''), 4, '0')
            || COALESCE(parts[4], '') AS new_number
    FROM (
        SELECT
            id,
            regexp_match(substring(order_number FROM 5), '^(.+)-([0-9]{6})-(O?[0-9]+)(.*)$') AS parts
        FROM cod_close_day_line_items
        WHERE order_number LIKE 'MIG|%'
    ) x
    WHERE parts IS NOT NULL
) m
WHERE c.id = m.id;
