ALTER TABLE vendor_commercial_terms
    ADD COLUMN IF NOT EXISTS per_piece_amount NUMERIC(12, 2);

ALTER TABLE vendor_commercial_terms DROP CONSTRAINT IF EXISTS chk_vendor_fee_model;

ALTER TABLE vendor_commercial_terms
    ADD CONSTRAINT chk_vendor_fee_model CHECK (fee_model IN (
        'NONE',
        'PER_ORDER_FLAT',
        'COMMISSION_PCT',
        'SLAB_COMMISSION',
        'MONTHLY_SUBSCRIPTION',
        'HYBRID',
        'PER_PIECE',
        'PER_PIECE_WITH_SUBSCRIPTION',
        'PER_ORDER_WITH_SUBSCRIPTION'
    ));
