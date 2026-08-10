-- Rewrite legacy order numbers to NRPT/AP-ddMMyy-0001 (strip optional O sequence prefix).
-- Two-phase update avoids unique collisions while rows are being rewritten.

UPDATE orders
SET order_number = 'MIG|' || order_number
WHERE order_number ~ '^.+-[0-9]{6}-O?[0-9]+'
  AND order_number NOT LIKE 'MIG|%';

UPDATE orders o
SET order_number = m.new_number
FROM (
    SELECT
        id,
        (regexp_match(substring(order_number FROM 5), '^(.+)-([0-9]{6})-O?([0-9]+)(.*)$'))[1]
            || '-'
            || to_char(timezone('Asia/Kolkata', COALESCE(placed_at, created_at))::date, 'DDMMYY')
            || '-'
            || lpad((regexp_match(substring(order_number FROM 5), '^(.+)-([0-9]{6})-O?([0-9]+)(.*)$'))[3], 4, '0')
            || COALESCE((regexp_match(substring(order_number FROM 5), '^(.+)-([0-9]{6})-O?([0-9]+)(.*)$'))[4], '')
            AS new_number
    FROM orders
    WHERE order_number LIKE 'MIG|%'
) m
WHERE o.id = m.id;

UPDATE vendor_sub_orders
SET sub_order_number = 'MIG|' || sub_order_number
WHERE sub_order_number ~ '^.+-[0-9]{6}-O?[0-9]+'
  AND sub_order_number NOT LIKE 'MIG|%';

UPDATE vendor_sub_orders v
SET sub_order_number = o.order_number
    || COALESCE(substring(substring(v.sub_order_number FROM 5) FROM '(-[0-9]+/[0-9]+)$'), '')
FROM orders o
WHERE v.order_id = o.id
  AND v.sub_order_number LIKE 'MIG|%';
