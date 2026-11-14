ALTER TABLE diagnostics_packages
    ADD COLUMN IF NOT EXISTS description TEXT;
