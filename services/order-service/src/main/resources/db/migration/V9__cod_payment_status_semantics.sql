-- COD was historically marked PAID at placement (before cash collection).
-- Cancelled COD orders must not look paid; open COD stays pending until delivery.
UPDATE orders
SET payment_status = 'PENDING',
    updated_at = now()
WHERE payment_method = 'COD'
  AND status = 'CANCELLED'
  AND payment_status IN ('PAID', 'FAILED');

-- Open (not yet delivered) COD orders still marked PAID at place-time → due, not collected.
UPDATE orders
SET payment_status = 'PENDING',
    updated_at = now()
WHERE payment_method = 'COD'
  AND status = 'PLACED'
  AND payment_status = 'PAID';
