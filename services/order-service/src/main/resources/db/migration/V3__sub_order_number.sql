ALTER TABLE vendor_sub_orders
    ADD COLUMN sub_order_number VARCHAR(50);

WITH numbered AS (
    SELECT
        vso.id,
        o.order_number || '-' ||
            ROW_NUMBER() OVER (PARTITION BY vso.order_id ORDER BY vso.vendor_id, vso.shop_id, vso.created_at, vso.id)
            || '/' ||
            COUNT(*) OVER (PARTITION BY vso.order_id) AS generated_number
    FROM vendor_sub_orders vso
    JOIN orders o ON o.id = vso.order_id
)
UPDATE vendor_sub_orders vso
SET sub_order_number = numbered.generated_number
FROM numbered
WHERE vso.id = numbered.id;

ALTER TABLE vendor_sub_orders
    ALTER COLUMN sub_order_number SET NOT NULL;

CREATE UNIQUE INDEX idx_vendor_sub_orders_number ON vendor_sub_orders(sub_order_number);
