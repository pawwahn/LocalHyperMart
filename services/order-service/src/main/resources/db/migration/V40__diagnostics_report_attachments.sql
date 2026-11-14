ALTER TABLE diagnostics_orders
    ADD COLUMN IF NOT EXISTS samples_bench_confirmed_at TIMESTAMPTZ;

ALTER TABLE diagnostics_orders
    ADD COLUMN IF NOT EXISTS report_attachment_meta VARCHAR(2000);
