-- Close gap before HYBRID terms (dev pilot: R K Fancy). Past settlements stay as recorded;
-- new quotes use ₹10/order for 14–26 Sep 2026 instead of implicit 0%.
UPDATE vendor_commercial_terms
SET effective_to = DATE '2026-09-26',
    updated_at   = NOW()
WHERE fee_model = 'PER_ORDER_FLAT'
  AND effective_from = DATE '2026-09-07'
  AND effective_to = DATE '2026-09-13'
  AND per_order_flat_amount = 10.00;
