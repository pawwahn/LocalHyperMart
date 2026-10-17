-- Calendar date the money moved on the bank statement.
-- vendor_paid_at stays the moment the vendor told the app.
ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS bank_paid_on DATE;
