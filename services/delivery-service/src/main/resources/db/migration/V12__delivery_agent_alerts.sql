-- Shop or hub reminders for assigned delivery agents (PENDING until agent taps Got it).
CREATE TABLE delivery_agent_alerts (
    id UUID PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES delivery_assignments(id),
    agent_id UUID NOT NULL REFERENCES delivery_agents(id),
    order_id UUID NOT NULL,
    vendor_sub_order_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    shop_id UUID,
    town_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    message TEXT,
    created_by UUID NOT NULL,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_agent_alerts_agent_status
    ON delivery_agent_alerts(agent_id, status, created_at DESC);

CREATE INDEX idx_delivery_agent_alerts_sub_order
    ON delivery_agent_alerts(vendor_sub_order_id, created_at DESC);

CREATE UNIQUE INDEX uq_delivery_agent_alerts_pending_assignment
    ON delivery_agent_alerts(assignment_id)
    WHERE status = 'PENDING';
