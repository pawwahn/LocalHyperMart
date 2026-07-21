ALTER TABLE vendor_listings
    ADD COLUMN vendor_mrp DECIMAL(12,2),
    ADD COLUMN special_discount_price DECIMAL(12,2),
    ADD COLUMN special_discount_valid_from TIMESTAMPTZ,
    ADD COLUMN special_discount_valid_to TIMESTAMPTZ;
