ALTER TABLE vendor_listings
    ADD COLUMN buyer_out_of_stock BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN vendor_listings.buyer_out_of_stock IS
    'When true and active, listing appears in buyer browse but cannot be added to cart (shown as out of stock).';
