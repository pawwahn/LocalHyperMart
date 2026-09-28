-- Snapshotted GST/HSN on each order line for legal invoices (values at time of purchase).

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS hsn_code_snapshot VARCHAR(8),
    ADD COLUMN IF NOT EXISTS gst_percent_snapshot NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS cess_percent_snapshot NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS price_includes_tax_snapshot BOOLEAN,
    ADD COLUMN IF NOT EXISTS country_of_origin_snapshot CHAR(2),
    ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cess_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS line_tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0;
