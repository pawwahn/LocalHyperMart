CREATE TABLE diagnostics_day_seq (
    day         DATE PRIMARY KEY,
    next_val    INT NOT NULL DEFAULT 1
);

CREATE TABLE diagnostics_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number            VARCHAR(24) NOT NULL UNIQUE,
    town_id                 UUID NOT NULL,
    vendor_id               UUID NOT NULL,
    shop_name               VARCHAR(150) NOT NULL,
    buyer_id                UUID NOT NULL,
    patient_profile_id      UUID NOT NULL,
    patient_name            VARCHAR(120) NOT NULL,
    reference_type          VARCHAR(20) NOT NULL,
    referring_doctor_name   VARCHAR(120),
    serving_branch_id       UUID NOT NULL,
    serving_branch_label    VARCHAR(120),
    status                  VARCHAR(40) NOT NULL,
    payment_method          VARCHAR(20) NOT NULL,
    payment_status          VARCHAR(20) NOT NULL,
    tests_subtotal          NUMERIC(12, 2) NOT NULL,
    home_collection_fee     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    platform_fee_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cod_fee                 NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_collected        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    address_id              UUID NOT NULL,
    address_text            VARCHAR(500) NOT NULL,
    contact_name            VARCHAR(120),
    contact_phone             VARCHAR(15),
    slot_start              TIMESTAMPTZ NOT NULL,
    slot_end                TIMESTAMPTZ NOT NULL,
    assigned_staff_id       UUID,
    assigned_staff_name     VARCHAR(120),
    report_eta              TIMESTAMPTZ,
    report_finalized_at     TIMESTAMPTZ,
    placed_at               TIMESTAMPTZ NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    updated_by              UUID
);

CREATE INDEX idx_diagnostics_orders_buyer ON diagnostics_orders(buyer_id, town_id, placed_at DESC);
CREATE INDEX idx_diagnostics_orders_vendor ON diagnostics_orders(vendor_id, status, placed_at DESC);
CREATE INDEX idx_diagnostics_orders_assigned ON diagnostics_orders(assigned_staff_id, status);

CREATE TABLE diagnostics_order_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES diagnostics_orders(id) ON DELETE CASCADE,
    test_id         UUID,
    test_name       VARCHAR(200) NOT NULL,
    unit_price      NUMERIC(12, 2) NOT NULL,
    result_value    VARCHAR(200),
    result_unit     VARCHAR(40),
    reference_range VARCHAR(120),
    result_flag     VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    updated_by      UUID
);

CREATE INDEX idx_diagnostics_order_lines_order ON diagnostics_order_lines(order_id);

CREATE TABLE diagnostics_order_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES diagnostics_orders(id) ON DELETE CASCADE,
    actor_user_id   UUID,
    actor_staff_id  UUID,
    actor_roles     VARCHAR(200),
    event_type      VARCHAR(60) NOT NULL,
    from_status     VARCHAR(40),
    to_status       VARCHAR(40),
    note            VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagnostics_order_events_order ON diagnostics_order_events(order_id, created_at);
