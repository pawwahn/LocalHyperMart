ALTER TABLE master_items
    ADD COLUMN barcode VARCHAR(14);

CREATE UNIQUE INDEX ux_master_items_barcode
    ON master_items (barcode)
    WHERE barcode IS NOT NULL;
