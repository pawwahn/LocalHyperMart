ALTER TABLE vendor_registration_requests
    ADD COLUMN IF NOT EXISTS terms_acknowledged_at TIMESTAMPTZ;

ALTER TABLE vendor_registration_requests
    ADD COLUMN IF NOT EXISTS terms_legal_version INT;
