CREATE TABLE diagnostics_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    code            VARCHAR(40),
    name            VARCHAR(200) NOT NULL,
    price           NUMERIC(12, 2) NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID
);

CREATE INDEX idx_diagnostics_packages_vendor ON diagnostics_packages(vendor_id);

CREATE TABLE diagnostics_package_members (
    package_id      UUID NOT NULL REFERENCES diagnostics_packages(id) ON DELETE CASCADE,
    test_id         UUID NOT NULL REFERENCES diagnostics_tests(id) ON DELETE CASCADE,
    PRIMARY KEY (package_id, test_id)
);

CREATE INDEX idx_diagnostics_package_members_test ON diagnostics_package_members(test_id);
