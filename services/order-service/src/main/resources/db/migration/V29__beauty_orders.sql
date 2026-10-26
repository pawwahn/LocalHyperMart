CREATE TABLE beauty_orders (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number                VARCHAR(24) NOT NULL UNIQUE,
    town_id                     UUID NOT NULL,
    vendor_id                   UUID NOT NULL,
    artist_name                 VARCHAR(150) NOT NULL,
    buyer_id                    UUID NOT NULL,
    occasion                    VARCHAR(30),
    service_type                VARCHAR(30) NOT NULL,
    venue                       VARCHAR(20) NOT NULL,
    status                      VARCHAR(30) NOT NULL,
    payment_method              VARCHAR(20) NOT NULL,
    payment_status              VARCHAR(20) NOT NULL,
    service_amount              NUMERIC(12, 2) NOT NULL,
    travel_charge               NUMERIC(12, 2) NOT NULL DEFAULT 0,
    platform_fee_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cod_fee                     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_collected            NUMERIC(12, 2) NOT NULL DEFAULT 0,
    duration_minutes            INT NOT NULL,
    special_instructions        VARCHAR(400),
    address_id                  UUID,
    address_text                VARCHAR(500),
    studio_address              VARCHAR(300),
    contact_name                VARCHAR(120),
    contact_phone               VARCHAR(20),
    slot_start                  TIMESTAMPTZ NOT NULL,
    slot_end                    TIMESTAMPTZ NOT NULL,
    placed_at                   TIMESTAMPTZ NOT NULL,
    completed_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by                  UUID,
    updated_by                  UUID
);

CREATE INDEX idx_beauty_orders_buyer ON beauty_orders (buyer_id, placed_at DESC);
CREATE INDEX idx_beauty_orders_vendor ON beauty_orders (vendor_id, placed_at DESC);
CREATE INDEX idx_beauty_orders_town ON beauty_orders (town_id, placed_at DESC);

CREATE TABLE beauty_order_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES beauty_orders(id),
    action          VARCHAR(40) NOT NULL,
    from_status     VARCHAR(30),
    to_status       VARCHAR(30),
    note            VARCHAR(400),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID
);

CREATE INDEX idx_beauty_events_order ON beauty_order_events (order_id, created_at);

CREATE TABLE beauty_day_seq (
    day         DATE PRIMARY KEY,
    last_no     INT NOT NULL
);
