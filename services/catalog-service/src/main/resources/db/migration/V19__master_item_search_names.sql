-- Extra names on the master product. Buyer search matches these or a vendor's own extra names.

ALTER TABLE master_items
    ADD COLUMN IF NOT EXISTS search_names VARCHAR(500);
