-- Product tax / compliance (HSN + GST), aligned with Indian e-commerce invoice requirements.
-- Review HSN defaults before public launch — set correct codes per SKU in Super Admin Catalog.

ALTER TABLE master_items
    ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    ADD COLUMN IF NOT EXISTS cess_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_includes_tax BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS country_of_origin CHAR(2) NOT NULL DEFAULT 'IN';

UPDATE master_items
SET hsn_code = COALESCE(NULLIF(TRIM(hsn_code), ''), '999799')
WHERE hsn_code IS NULL OR TRIM(hsn_code) = '';

ALTER TABLE master_items
    ALTER COLUMN hsn_code SET NOT NULL;

ALTER TABLE master_items
    ADD CONSTRAINT master_items_hsn_format_chk CHECK (hsn_code ~ '^[0-9]{4,8}$');

ALTER TABLE master_items
    ADD CONSTRAINT master_items_gst_slabs_chk CHECK (gst_percent IN (0, 0.25, 3, 5, 12, 18, 28));

ALTER TABLE master_items
    ADD CONSTRAINT master_items_cess_chk CHECK (cess_percent >= 0 AND cess_percent <= 100);

CREATE INDEX IF NOT EXISTS idx_master_items_hsn ON master_items(hsn_code);
