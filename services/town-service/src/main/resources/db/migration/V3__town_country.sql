-- Multi-country support for towns
ALTER TABLE towns
    ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'India',
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NOT NULL DEFAULT 'IN';

UPDATE towns SET country = 'India', country_code = 'IN'
WHERE country IS NULL OR country_code IS NULL OR country_code = '';

ALTER TABLE towns DROP CONSTRAINT IF EXISTS towns_name_state_key;
ALTER TABLE towns DROP CONSTRAINT IF EXISTS towns_town_code_state_code_key;

ALTER TABLE towns
    ADD CONSTRAINT towns_name_state_country_key UNIQUE (name, state, country_code);

ALTER TABLE towns
    ADD CONSTRAINT towns_town_code_state_country_key UNIQUE (town_code, state_code, country_code);

CREATE INDEX IF NOT EXISTS idx_towns_country_code ON towns (country_code);
