-- Named services a vendor must belong to (Groceries, Laundry, …).
CREATE TABLE vendor_services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(80) NOT NULL,
    hides_listings  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID
);

CREATE UNIQUE INDEX uq_vendor_services_name ON vendor_services (lower(name));

INSERT INTO vendor_services (id, name, hides_listings, sort_order)
VALUES
    ('a1111111-1111-4111-8111-111111111111', 'Groceries', FALSE, 1),
    ('a2222222-2222-4222-8222-222222222222', 'Laundry', TRUE, 2);

ALTER TABLE vendors
    ADD COLUMN service_id UUID REFERENCES vendor_services(id);

ALTER TABLE vendor_registration_requests
    ADD COLUMN service_id UUID REFERENCES vendor_services(id);

CREATE INDEX idx_vendors_service ON vendors(service_id);

-- Shops already set up as laundry providers are Laundry, so their menu drops Listings.
UPDATE vendors v
SET service_id = 'a2222222-2222-4222-8222-222222222222'
WHERE v.service_id IS NULL
  AND EXISTS (SELECT 1 FROM laundry_profiles p WHERE p.vendor_id = v.id);
