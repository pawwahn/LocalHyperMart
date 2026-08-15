-- Hub-triggered vendor reminders. Stay PENDING until the vendor taps Noticed order.
CREATE TABLE vendor_order_alerts (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    vendor_sub_order_id UUID NOT NULL REFERENCES vendor_sub_orders(id),
    vendor_id UUID NOT NULL,
    shop_id UUID NOT NULL,
    town_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    message TEXT,
    created_by UUID NOT NULL,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_order_alerts_vendor_status
    ON vendor_order_alerts(vendor_id, status, created_at DESC);

CREATE INDEX idx_vendor_order_alerts_town_status
    ON vendor_order_alerts(town_id, status, created_at DESC);

CREATE INDEX idx_vendor_order_alerts_sub_order
    ON vendor_order_alerts(vendor_sub_order_id, created_at DESC);

-- At most one ringing reminder per shop bag.
CREATE UNIQUE INDEX uq_vendor_order_alerts_pending_sub
    ON vendor_order_alerts(vendor_sub_order_id)
    WHERE status = 'PENDING';
