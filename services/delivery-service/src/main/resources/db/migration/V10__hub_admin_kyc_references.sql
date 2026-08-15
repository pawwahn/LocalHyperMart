-- KYC details captured when super-admin creates a hub + hub-admin login.
ALTER TABLE hub_admins
    ADD COLUMN IF NOT EXISTS govt_id_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS govt_id_number VARCHAR(40),
    ADD COLUMN IF NOT EXISTS reference1_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS reference1_phone VARCHAR(15),
    ADD COLUMN IF NOT EXISTS reference2_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS reference2_phone VARCHAR(15);

COMMENT ON COLUMN hub_admins.govt_id_type IS 'AADHAAR | VOTER_ID | DRIVING_LICENSE | PAN | OTHER';
