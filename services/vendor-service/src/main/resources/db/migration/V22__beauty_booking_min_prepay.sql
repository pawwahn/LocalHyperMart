ALTER TABLE beauty_profiles
    ADD COLUMN IF NOT EXISTS booking_min_prepay_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN beauty_profiles.booking_min_prepay_amount IS
    'Admin-set minimum online prepay (INR) when buyer chooses partial payment. 0 = full payment only.';
