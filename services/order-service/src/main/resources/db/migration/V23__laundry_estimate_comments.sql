ALTER TABLE laundry_orders
    ADD COLUMN estimated_ready_at TIMESTAMPTZ,
    ADD COLUMN buyer_comment VARCHAR(400),
    ADD COLUMN vendor_comment VARCHAR(400),
    ADD COLUMN wallet_credited NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Placed orders are accepted. A pickup time the customer already gave is the pickup slot.
UPDATE laundry_orders
SET status = 'PICKUP_SCHEDULED',
    pickup_slot_start = COALESCE(pickup_slot_start, requested_pickup_start),
    pickup_slot_end = COALESCE(pickup_slot_end, requested_pickup_end)
WHERE status = 'REQUESTED'
  AND logistics <> 'DROP_ONLY'
  AND requested_pickup_start IS NOT NULL;

UPDATE laundry_orders
SET status = 'ACCEPTED'
WHERE status = 'REQUESTED';
