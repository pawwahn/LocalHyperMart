INSERT INTO vendor_services (id, name, hides_listings, sort_order)
SELECT 'a4444444-4444-4444-8444-444444444444', 'Diagnostics & Lab', TRUE, 4
WHERE NOT EXISTS (SELECT 1 FROM vendor_services WHERE id = 'a4444444-4444-4444-8444-444444444444');

CREATE TABLE diagnostics_profiles (
    vendor_id           UUID PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    home_collection_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    bookable            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

CREATE TABLE diagnostics_branches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id               UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    label                   VARCHAR(120) NOT NULL,
    address_line            VARCHAR(500) NOT NULL,
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,
    home_collection_radius_km NUMERIC(6, 2) NOT NULL DEFAULT 5,
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order              INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    updated_by              UUID
);

CREATE INDEX idx_diagnostics_branches_vendor ON diagnostics_branches(vendor_id);

CREATE TABLE diagnostics_tests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    code                VARCHAR(40),
    name                VARCHAR(200) NOT NULL,
    price               NUMERIC(12, 2) NOT NULL,
    fasting_note        VARCHAR(400),
    prescription_required BOOLEAN NOT NULL DEFAULT FALSE,
    home_collection     BOOLEAN NOT NULL DEFAULT TRUE,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

CREATE INDEX idx_diagnostics_tests_vendor ON diagnostics_tests(vendor_id);

CREATE TABLE diagnostics_slot_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES diagnostics_branches(id) ON DELETE CASCADE,
    label           VARCHAR(40) NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    capacity        INT NOT NULL DEFAULT 2,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagnostics_slots_branch ON diagnostics_slot_templates(branch_id);

CREATE TABLE diagnostics_staff (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL,
    phone               VARCHAR(15) NOT NULL,
    display_name        VARCHAR(120) NOT NULL,
    role_type           VARCHAR(20) NOT NULL DEFAULT 'LAB_STAFF',
    title               VARCHAR(30),
    collection_capable  BOOLEAN NOT NULL DEFAULT FALSE,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT uq_diagnostics_staff_user UNIQUE (user_id),
    CONSTRAINT uq_diagnostics_staff_vendor_phone UNIQUE (vendor_id, phone)
);

CREATE INDEX idx_diagnostics_staff_vendor ON diagnostics_staff(vendor_id);

CREATE TABLE diagnostics_staff_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL,
    actor_staff_id  UUID,
    event_type      VARCHAR(60) NOT NULL,
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagnostics_staff_audit_vendor ON diagnostics_staff_audit(vendor_id, created_at DESC);
