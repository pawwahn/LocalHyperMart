CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_replay
    ON payment_webhook_logs (signature_valid, processed, received_at);
