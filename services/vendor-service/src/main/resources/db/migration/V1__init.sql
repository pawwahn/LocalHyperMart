CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE vendor_registration_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id              UUID NOT NULL,
    requested_by         UUID NOT NULL,
    business_name        VARCHAR(255) NOT NULL,
    owner_name           VARCHAR(255),
    phone                VARCHAR(15) NOT NULL,
    shop_name            VARCHAR(255) NOT NULL,
    address              TEXT,
    gst_number_enc       TEXT,
    bank_account_enc     TEXT,
    ifsc_enc             TEXT,
    shop_image_media_id  UUID,
    gst_cert_media_id    UUID,
    status               VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reviewed_by          UUID,
    reviewed_at          TIMESTAMPTZ,
    reject_reason        TEXT,
    vendor_id            UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by           UUID,
    updated_by           UUID
);

CREATE TABLE vendors (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id                  UUID NOT NULL,
    user_id                  UUID NOT NULL,
    registration_request_id  UUID REFERENCES vendor_registration_requests(id),
    business_name            VARCHAR(255) NOT NULL,
    owner_name               VARCHAR(255),
    phone                    VARCHAR(15) NOT NULL,
    gst_number_enc           TEXT,
    bank_account_enc         TEXT,
    ifsc_enc                 TEXT,
    status                   VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    disabled_by              UUID,
    disabled_reason          TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by               UUID,
    updated_by               UUID
);

CREATE TABLE shops (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id            UUID NOT NULL REFERENCES vendors(id),
    shop_name            VARCHAR(255) NOT NULL,
    address              TEXT,
    pincode              VARCHAR(10),
    latitude             DECIMAL(10,8),
    longitude            DECIMAL(11,8),
    closed_days_note     TEXT,
    shop_image_media_id  UUID,
    status               VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by           UUID,
    updated_by           UUID
);

CREATE INDEX idx_vendors_town ON vendors(town_id);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_shops_vendor ON shops(vendor_id);
