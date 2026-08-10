-- Align denormalized assignment order numbers with NRPT/AP-ddMMyy-0001.

UPDATE delivery_assignments
SET order_number = 'MIG|' || order_number
WHERE order_number ~ '^.+-[0-9]{6}-O?[0-9]+'
  AND order_number NOT LIKE 'MIG|%'
  AND (
      order_number ~ '-[0-9]{6}-O[0-9]'
      OR substring(order_number FROM '-([0-9]{2})[0-9]{4}-')::int BETWEEN 20 AND 29
  );

UPDATE delivery_assignments da
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
        FROM delivery_assignments
        WHERE order_number LIKE 'MIG|%'
    ) x
    WHERE parts IS NOT NULL
) m
WHERE da.id = m.id;

UPDATE delivery_assignments
SET sub_order_number = 'MIG|' || sub_order_number
WHERE sub_order_number ~ '^.+-[0-9]{6}-O?[0-9]+'
  AND sub_order_number NOT LIKE 'MIG|%'
  AND (
      sub_order_number ~ '-[0-9]{6}-O[0-9]'
      OR substring(sub_order_number FROM '-([0-9]{2})[0-9]{4}-')::int BETWEEN 20 AND 29
  );

UPDATE delivery_assignments da
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
        FROM delivery_assignments
        WHERE sub_order_number LIKE 'MIG|%'
    ) x
    WHERE parts IS NOT NULL
) m
WHERE da.id = m.id;

UPDATE delivery_assignments
SET assignment_number = 'MIG|' || assignment_number
WHERE assignment_number IS NOT NULL
  AND assignment_number NOT LIKE 'MIG|%'
  AND (assignment_number LIKE '%-TO-HUB' OR assignment_number LIKE '%-TO-BUYER');

UPDATE delivery_assignments
SET assignment_number = sub_order_number || '-TO-HUB'
WHERE assignment_number LIKE 'MIG|%-TO-HUB'
  AND sub_order_number IS NOT NULL;

UPDATE delivery_assignments
SET assignment_number = order_number || '-TO-BUYER'
WHERE assignment_number LIKE 'MIG|%-TO-BUYER'
  AND order_number IS NOT NULL;
