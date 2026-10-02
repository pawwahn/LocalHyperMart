ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS vendor_agent_delivery BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE vendor_sub_orders
    ADD COLUMN IF NOT EXISTS vendor_agent_delivery_at TIMESTAMPTZ;
