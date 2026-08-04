-- Allow multiple commercial-terms versions per vendor (effective-dated history).
ALTER TABLE vendor_commercial_terms
    DROP CONSTRAINT IF EXISTS vendor_commercial_terms_vendor_id_key;

ALTER TABLE vendor_commercial_terms
    ADD COLUMN IF NOT EXISTS effective_to DATE;

-- One open-ended (current) version per vendor.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_commercial_terms_open
    ON vendor_commercial_terms (vendor_id)
    WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_commercial_terms_vendor_dates
    ON vendor_commercial_terms (vendor_id, effective_from, effective_to);
