-- Diagnostics lab type values (PRIVATE_LAB, HOSPITAL_LAB) need more than 10 chars.
ALTER TABLE vendor_registration_requests
    ALTER COLUMN service_for TYPE VARCHAR(20);

ALTER TABLE vendors
    ALTER COLUMN service_for TYPE VARCHAR(20);
