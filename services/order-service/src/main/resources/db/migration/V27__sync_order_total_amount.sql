-- Reconcile persisted total_amount with checkout formula (incl. store credit).
UPDATE orders
SET total_amount = GREATEST(
        COALESCE(items_subtotal, 0) - COALESCE(promo_discount, 0)
            + COALESCE(delivery_fee, 0) + COALESCE(platform_fee, 0)
            + COALESCE(cod_fee, 0) + COALESCE(membership_fee, 0)
            - COALESCE(store_credit_applied, 0),
        0),
    updated_at = NOW()
WHERE total_amount IS DISTINCT FROM GREATEST(
        COALESCE(items_subtotal, 0) - COALESCE(promo_discount, 0)
            + COALESCE(delivery_fee, 0) + COALESCE(platform_fee, 0)
            + COALESCE(cod_fee, 0) + COALESCE(membership_fee, 0)
            - COALESCE(store_credit_applied, 0),
        0);
