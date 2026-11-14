CREATE TABLE patient_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_user_id UUID NOT NULL,
    display_name    VARCHAR(120) NOT NULL,
    relation        VARCHAR(30) NOT NULL,
    gender          VARCHAR(20) NOT NULL,
    age_years       INT,
    date_of_birth   DATE,
    notes           VARCHAR(400),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID
);

CREATE INDEX idx_patient_profiles_account ON patient_profiles(account_user_id, active);
