CREATE TABLE laundry_orders (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number                VARCHAR(24) NOT NULL UNIQUE,
    town_id                     UUID NOT NULL,
    vendor_id                   UUID NOT NULL,
    shop_name                   VARCHAR(150) NOT NULL,
    buyer_id                    UUID NOT NULL,
    logistics                   VARCHAR(30) NOT NULL,
    status                      VARCHAR(30) NOT NULL,
    payment_method              VARCHAR(20) NOT NULL,
    payment_status              VARCHAR(20) NOT NULL,
    goods_amount                NUMERIC(12, 2) NOT NULL,
    amount_collected            NUMERIC(12, 2) NOT NULL DEFAULT 0,
    platform_fee_model          VARCHAR(40),
    platform_per_piece          NUMERIC(12, 2),
    platform_per_order          NUMERIC(12, 2),
    platform_fee_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    piece_count                 INT NOT NULL,
    special_instructions        VARCHAR(400),
    address_id                  UUID NOT NULL,
    address_text                VARCHAR(500) NOT NULL,
    contact_name                VARCHAR(120),
    contact_phone               VARCHAR(20),
    requested_pickup_start      TIMESTAMPTZ,
    requested_pickup_end        TIMESTAMPTZ,
    pickup_slot_start           TIMESTAMPTZ,
    pickup_slot_end             TIMESTAMPTZ,
    pickup_reschedule_count     INT NOT NULL DEFAULT 0,
    rewash_used                 BOOLEAN NOT NULL DEFAULT FALSE,
    complaint_open              BOOLEAN NOT NULL DEFAULT FALSE,
    placed_at                   TIMESTAMPTZ NOT NULL,
    delivered_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by                  UUID,
    updated_by                  UUID
);

CREATE INDEX idx_laundry_orders_buyer ON laundry_orders (buyer_id, placed_at DESC);
CREATE INDEX idx_laundry_orders_vendor ON laundry_orders (vendor_id, placed_at DESC);
CREATE INDEX idx_laundry_orders_town ON laundry_orders (town_id, placed_at DESC);
CREATE INDEX idx_laundry_orders_vendor_day ON laundry_orders (vendor_id, placed_at) WHERE status <> 'CANCELLED';

CREATE TABLE laundry_order_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES laundry_orders(id),
    service_type            VARCHAR(30) NOT NULL,
    item_type               VARCHAR(30) NOT NULL,
    other_label             VARCHAR(80),
    quantity                INT NOT NULL,
    confirmed_quantity      INT NOT NULL,
    unit_price              NUMERIC(12, 2) NOT NULL,
    condition_note          VARCHAR(200),
    photo_media_id          UUID,
    photo_deleted_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    updated_by              UUID,
    CONSTRAINT chk_laundry_line_qty CHECK (quantity >= 1 AND confirmed_quantity >= 0)
);

CREATE UNIQUE INDEX uq_laundry_line_photo
    ON laundry_order_lines (photo_media_id)
    WHERE photo_media_id IS NOT NULL;

CREATE INDEX idx_laundry_lines_order ON laundry_order_lines (order_id);
CREATE INDEX idx_laundry_lines_photo_purge
    ON laundry_order_lines (photo_media_id)
    WHERE photo_media_id IS NOT NULL AND photo_deleted_at IS NULL;

CREATE TABLE laundry_order_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES laundry_orders(id),
    action          VARCHAR(40) NOT NULL,
    from_status     VARCHAR(30),
    to_status       VARCHAR(30),
    note            VARCHAR(400),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID
);

CREATE INDEX idx_laundry_events_order ON laundry_order_events (order_id, created_at);

CREATE TABLE laundry_day_seq (
    day         DATE PRIMARY KEY,
    last_no     INT NOT NULL
);
