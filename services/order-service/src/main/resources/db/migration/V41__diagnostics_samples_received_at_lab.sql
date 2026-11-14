ALTER TABLE diagnostics_orders
    ADD COLUMN IF NOT EXISTS samples_received_at_lab_at TIMESTAMPTZ;

UPDATE diagnostics_orders
SET samples_received_at_lab_at = updated_at
WHERE samples_received_at_lab_at IS NULL
  AND status IN (
      'RECEIVED_AT_LAB',
      'REPORT_ETA_SET',
      'REPORT_IN_PROGRESS',
      'REPORT_FINALIZED',
      'COMPLETED'
  );
