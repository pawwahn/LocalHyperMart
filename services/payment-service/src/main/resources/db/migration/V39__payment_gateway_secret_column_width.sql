ALTER TABLE payment_gateway_config
    ALTER COLUMN client_secret TYPE VARCHAR(1024);

ALTER TABLE payment_gateway_config
    ALTER COLUMN webhook_secret TYPE VARCHAR(1024);

ALTER TABLE payment_gateway_config
    ALTER COLUMN webhook_password TYPE VARCHAR(1024);
