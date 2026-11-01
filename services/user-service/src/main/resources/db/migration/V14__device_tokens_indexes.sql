CREATE UNIQUE INDEX IF NOT EXISTS uq_device_tokens_fcm_token ON device_tokens (fcm_token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_app ON device_tokens (user_id, app_type);
