ALTER TABLE settlements
    ALTER COLUMN service_invoice_number TYPE VARCHAR(48);

CREATE TABLE IF NOT EXISTS vendor_invoice_sequences (
    town_id     UUID NOT NULL,
    fy          VARCHAR(8) NOT NULL,
    last_value  INTEGER NOT NULL,
    PRIMARY KEY (town_id, fy)
);
