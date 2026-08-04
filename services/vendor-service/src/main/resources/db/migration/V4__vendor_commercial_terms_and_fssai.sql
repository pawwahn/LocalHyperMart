-- Optional food-licence identifier captured at registration / on vendor profile.
ALTER TABLE vendor_registration_requests
    ADD COLUMN IF NOT EXISTS fssai_number VARCHAR(32);

ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS fssai_number VARCHAR(32);

-- Per-vendor commercial terms (town-independent). One active row per vendor for v1.
CREATE TABLE IF NOT EXISTS vendor_commercial_terms (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id                       UUID NOT NULL UNIQUE REFERENCES vendors(id),
    fee_model                       VARCHAR(40) NOT NULL DEFAULT 'NONE',
    commission_percent              NUMERIC(8, 4),
    per_order_flat_amount           NUMERIC(12, 2),
    monthly_subscription_amount     NUMERIC(12, 2),
    subscription_billing_day        INT,
    -- JSON array: [{"uptoAmount":10000,"percent":5.0},{"uptoAmount":null,"percent":3.0}]
    commission_slabs_json           TEXT,
    notes                           TEXT,
    effective_from                  DATE NOT NULL DEFAULT CURRENT_DATE,
    last_subscription_charged_ym    VARCHAR(7),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by                      UUID,
    updated_by                      UUID,
    CONSTRAINT chk_vendor_fee_model CHECK (fee_model IN (
        'NONE',
        'PER_ORDER_FLAT',
        'COMMISSION_PCT',
        'SLAB_COMMISSION',
        'MONTHLY_SUBSCRIPTION',
        'HYBRID'
    )),
    CONSTRAINT chk_subscription_billing_day CHECK (
        subscription_billing_day IS NULL
        OR (subscription_billing_day >= 1 AND subscription_billing_day <= 28)
    )
);

CREATE INDEX IF NOT EXISTS idx_vendor_commercial_terms_model
    ON vendor_commercial_terms (fee_model);

-- Existing vendors start with no platform fee until super-admin configures terms.
INSERT INTO vendor_commercial_terms (vendor_id, fee_model, effective_from)
SELECT v.id, 'NONE', CURRENT_DATE
FROM vendors v
WHERE NOT EXISTS (
    SELECT 1 FROM vendor_commercial_terms t WHERE t.vendor_id = v.id
);
