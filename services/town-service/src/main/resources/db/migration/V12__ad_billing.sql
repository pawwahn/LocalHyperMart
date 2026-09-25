CREATE TABLE ad_rate_cards (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_percent  NUMERIC(5, 2) NOT NULL DEFAULT 0,
    rates_json   TEXT NOT NULL,
    notes        VARCHAR(500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID,
    updated_by   UUID
);

INSERT INTO ad_rate_cards (id, tax_percent, rates_json, notes)
VALUES (
    '00000000-0000-0000-0000-00000000ad01',
    0,
    '{
      "HOME_HERO": {
        "day":   {"oneTown": 800,  "extraTown": 350,  "allTowns": 8000},
        "week":  {"oneTown": 4500, "extraTown": 1800, "allTowns": 40000},
        "month": {"oneTown": 15000,"extraTown": 5000, "allTowns": 120000}
      },
      "HOME_MID_GRID": {
        "day":   {"oneTown": 400,  "extraTown": 180,  "allTowns": 4000},
        "week":  {"oneTown": 2200, "extraTown": 900,  "allTowns": 20000},
        "month": {"oneTown": 7500, "extraTown": 2500, "allTowns": 60000}
      },
      "CART_UPSELL": {
        "day":   {"oneTown": 500,  "extraTown": 220,  "allTowns": 5000},
        "week":  {"oneTown": 2800, "extraTown": 1100, "allTowns": 25000},
        "month": {"oneTown": 9000, "extraTown": 3200, "allTowns": 75000}
      }
    }',
    'Default ad rate card — one town, extra town, all towns by day / week / month'
);

CREATE TABLE ad_invoices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number   VARCHAR(40) NOT NULL UNIQUE,
    status           VARCHAR(20) NOT NULL,
    advertiser_name  VARCHAR(160) NOT NULL,
    advertiser_phone VARCHAR(20) NOT NULL,
    advertiser_gstin VARCHAR(20),
    notes            VARCHAR(500),
    slot             VARCHAR(40) NOT NULL,
    slot_index       SMALLINT NOT NULL DEFAULT 0,
    period           VARCHAR(16) NOT NULL,
    town_scope       VARCHAR(20) NOT NULL,
    all_towns        BOOLEAN NOT NULL DEFAULT FALSE,
    town_ids_json    TEXT NOT NULL DEFAULT '[]',
    from_date        DATE NOT NULL,
    to_date          DATE NOT NULL,
    calendar_days    INTEGER NOT NULL,
    billable_units   INTEGER NOT NULL,
    unit_one_town    NUMERIC(12, 2) NOT NULL,
    unit_extra_town  NUMERIC(12, 2) NOT NULL,
    unit_all_towns   NUMERIC(12, 2) NOT NULL,
    tax_percent      NUMERIC(5, 2) NOT NULL DEFAULT 0,
    subtotal         NUMERIC(12, 2) NOT NULL,
    tax_amount       NUMERIC(12, 2) NOT NULL,
    total            NUMERIC(12, 2) NOT NULL,
    paid_at          TIMESTAMPTZ,
    paid_method      VARCHAR(20),
    paid_reference   VARCHAR(80),
    paid_by          UUID,
    voided_at        TIMESTAMPTZ,
    void_reason      VARCHAR(240),
    voided_by        UUID,
    issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issued_by        UUID,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID,
    updated_by       UUID,
    CONSTRAINT ad_invoices_dates_chk CHECK (to_date >= from_date),
    CONSTRAINT ad_invoices_units_chk CHECK (calendar_days >= 1 AND billable_units >= 1),
    CONSTRAINT ad_invoices_total_chk CHECK (total >= 0 AND subtotal >= 0 AND tax_amount >= 0)
);

CREATE INDEX idx_ad_invoices_status_issued ON ad_invoices (status, issued_at DESC);
CREATE INDEX idx_ad_invoices_slot_dates ON ad_invoices (slot, slot_index, from_date, to_date);
CREATE INDEX idx_ad_invoices_advertiser ON ad_invoices (advertiser_phone, issued_at DESC);
