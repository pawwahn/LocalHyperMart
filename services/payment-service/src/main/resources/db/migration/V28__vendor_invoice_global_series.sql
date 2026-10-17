-- One KK/{FY}/{MON}/{seq} series for all towns; existing numbers are reissued on startup.
DROP TABLE IF EXISTS vendor_invoice_sequences;
DELETE FROM service_invoice_sequences;
