CREATE INDEX IF NOT EXISTS idx_vso_vendor_status ON vendor_sub_orders(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_town_placed_at ON orders(town_id, placed_at);
