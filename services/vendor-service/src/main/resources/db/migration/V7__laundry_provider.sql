-- Laundry is a provider in one town. Rates belong to the shop, not the town.
CREATE TABLE laundry_profiles (
    vendor_id               UUID PRIMARY KEY REFERENCES vendors(id),
    enabled                 BOOLEAN NOT NULL DEFAULT FALSE,
    price_edit_allowed      BOOLEAN NOT NULL DEFAULT FALSE,
    daily_piece_capacity    INT,
    closed_weekdays         VARCHAR(80) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    updated_by              UUID,
    CONSTRAINT chk_laundry_capacity CHECK (daily_piece_capacity IS NULL OR daily_piece_capacity >= 1)
);

CREATE TABLE laundry_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    service_type    VARCHAR(30) NOT NULL,
    item_type       VARCHAR(30) NOT NULL,
    unit_price      NUMERIC(12, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID,
    CONSTRAINT uq_laundry_rate UNIQUE (vendor_id, service_type, item_type),
    CONSTRAINT chk_laundry_rate_price CHECK (unit_price >= 0),
    CONSTRAINT chk_laundry_service_type CHECK (service_type IN ('WASH_AND_IRON', 'WASH_ONLY', 'IRON_ONLY')),
    CONSTRAINT chk_laundry_item_type CHECK (item_type IN ('SAREE', 'SHIRT', 'PANTS', 'CURTAINS', 'BEDSHEET', 'TOWEL', 'OTHER'))
);

CREATE INDEX idx_laundry_rates_vendor ON laundry_rates (vendor_id);

CREATE TABLE laundry_rate_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    service_type    VARCHAR(30) NOT NULL,
    item_type       VARCHAR(30) NOT NULL,
    unit_price      NUMERIC(12, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID
);

CREATE INDEX idx_laundry_rate_history_vendor ON laundry_rate_history (vendor_id, created_at DESC);
