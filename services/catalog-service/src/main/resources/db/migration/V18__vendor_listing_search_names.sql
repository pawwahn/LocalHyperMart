-- Extra names a vendor types for search. Buyers still see the master product name and its image.

ALTER TABLE vendor_listings
    ADD COLUMN IF NOT EXISTS search_names VARCHAR(500);
