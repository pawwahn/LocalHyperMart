ALTER TABLE hub_payment_requests
    ADD COLUMN IF NOT EXISTS document_number VARCHAR(40);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_payment_requests_document_number
    ON hub_payment_requests (document_number)
    WHERE document_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS hub_bill_sequences (
    town_id     UUID NOT NULL,
    fy          VARCHAR(8) NOT NULL,
    last_value  INTEGER NOT NULL,
    PRIMARY KEY (town_id, fy)
);
