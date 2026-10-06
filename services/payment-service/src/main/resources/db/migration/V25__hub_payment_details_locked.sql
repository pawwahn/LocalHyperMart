ALTER TABLE hub_platform_payment_submissions
    ADD COLUMN IF NOT EXISTS hub_details_locked BOOLEAN NOT NULL DEFAULT FALSE;
