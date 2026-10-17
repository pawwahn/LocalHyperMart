-- Admin can reject a vendor-submitted subscription payment (with reason); vendor then pays / resubmits.
ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS vendor_payment_rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_payment_rejected_by UUID,
    ADD COLUMN IF NOT EXISTS vendor_payment_reject_reason VARCHAR(500);
