-- Who the vendor serves (e.g. beauty parlour audience). Required for new registrations.
ALTER TABLE vendor_registration_requests
    ADD COLUMN service_for VARCHAR(10);

ALTER TABLE vendors
    ADD COLUMN service_for VARCHAR(10);

UPDATE vendor_registration_requests SET service_for = 'UNISEX' WHERE service_for IS NULL;
UPDATE vendors SET service_for = 'UNISEX' WHERE service_for IS NULL;

ALTER TABLE vendor_registration_requests
    ALTER COLUMN service_for SET NOT NULL;

ALTER TABLE vendors
    ALTER COLUMN service_for SET NOT NULL;
