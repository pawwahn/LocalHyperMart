-- KYC details captured when hub registers a delivery agent.
ALTER TABLE delivery_agents
    ADD COLUMN IF NOT EXISTS govt_id_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS govt_id_number VARCHAR(40),
    ADD COLUMN IF NOT EXISTS reference1_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS reference1_phone VARCHAR(15),
    ADD COLUMN IF NOT EXISTS reference2_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS reference2_phone VARCHAR(15);

COMMENT ON COLUMN delivery_agents.govt_id_type IS 'AADHAAR | VOTER_ID | DRIVING_LICENSE | PAN | OTHER';
