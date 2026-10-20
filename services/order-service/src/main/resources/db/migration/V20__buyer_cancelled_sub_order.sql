-- Buyer cancels were stored as shop rejections. Keep shop refusals as VENDOR_REJECTED.
UPDATE vendor_sub_orders
SET status = 'BUYER_CANCELLED'
WHERE status = 'VENDOR_REJECTED'
  AND reject_reason ILIKE 'Buyer cancelled%';
