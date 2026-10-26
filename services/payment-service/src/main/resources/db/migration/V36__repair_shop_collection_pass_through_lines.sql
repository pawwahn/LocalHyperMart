-- Shop-held COLLECTION bill that recorded commercial commission only (CLX/AP-111026).
-- Idempotent: only when fee lines are still commission-only.
DO $$
DECLARE
    sid UUID := '721bbd9f-689f-4bb8-ac74-a0c27e6151a9';
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM settlements
        WHERE id = sid AND commission_amount = 50.49 AND direction = 'COLLECTION'
    ) THEN
        RETURN;
    END IF;
    IF EXISTS (
        SELECT 1 FROM settlement_line_items
        WHERE settlement_id = sid AND line_type IN ('PLATFORM_FEE', 'COD_FEE', 'MEMBERSHIP_FEE')
    ) THEN
        RETURN;
    END IF;

    INSERT INTO settlement_line_items (
        id, settlement_id, order_id, sub_order_id, order_number, sub_order_number,
        line_type, amount, description, created_at, updated_at
    ) VALUES
        (gen_random_uuid(), sid, NULL, NULL, NULL, NULL,
         'PLATFORM_FEE', 2.00, 'Platform fee collected from shop-held cash (repair)', NOW(), NOW()),
        (gen_random_uuid(), sid, NULL, NULL, NULL, NULL,
         'COD_FEE', 10.00, 'COD charge collected from shop-held cash (repair)', NOW(), NOW());

    UPDATE settlements
    SET commission_amount = 62.49,
        net_amount        = 62.49,
        updated_at        = NOW()
    WHERE id = sid;
END $$;
