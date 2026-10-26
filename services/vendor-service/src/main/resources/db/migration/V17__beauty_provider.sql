INSERT INTO vendor_services (id, name, hides_listings, sort_order)
VALUES ('a3333333-3333-4333-8333-333333333333', 'Makeup & Beauty', TRUE, 3)
ON CONFLICT DO NOTHING;

CREATE TABLE beauty_profiles (
    vendor_id               UUID PRIMARY KEY REFERENCES vendors(id),
    enabled                 BOOLEAN NOT NULL DEFAULT FALSE,
    tagline                 VARCHAR(200),
    years_experience        INT,
    rating_score            NUMERIC(3, 2) NOT NULL DEFAULT 4.80,
    rating_count            INT NOT NULL DEFAULT 0,
    home_visit_charge       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    studio_address          VARCHAR(300),
    closed_weekdays         VARCHAR(80) NOT NULL DEFAULT '',
    blocked_slot_date       DATE,
    blocked_slot_ids        VARCHAR(80) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    updated_by              UUID,
    CONSTRAINT chk_beauty_home_charge CHECK (home_visit_charge >= 0),
    CONSTRAINT chk_beauty_rating CHECK (rating_score >= 0 AND rating_score <= 5)
);

CREATE TABLE beauty_rates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id),
    service_type        VARCHAR(30) NOT NULL,
    unit_price          NUMERIC(12, 2) NOT NULL,
    duration_minutes    INT NOT NULL DEFAULT 60,
    paused              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT uq_beauty_rate UNIQUE (vendor_id, service_type),
    CONSTRAINT chk_beauty_rate_price CHECK (unit_price >= 0),
    CONSTRAINT chk_beauty_duration CHECK (duration_minutes >= 15 AND duration_minutes <= 480)
);

CREATE INDEX idx_beauty_rates_vendor ON beauty_rates (vendor_id);
