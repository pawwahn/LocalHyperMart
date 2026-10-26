ALTER TABLE beauty_orders ADD COLUMN IF NOT EXISTS service_types VARCHAR(250);

UPDATE beauty_orders SET service_types = service_type WHERE service_types IS NULL;
