-- Pilot town: Narsaraopet, Andhra Pradesh (fixed UUID for dev/test references)
INSERT INTO towns (
    id, name, state, town_code, state_code, display_name, coverage_radius_km, status
) VALUES (
    'a1111111-1111-4111-8111-111111111111',
    'Narsaraopet',
    'Andhra Pradesh',
    'NRPT',
    'AP',
    'Narsaraopet (Andhra Pradesh)',
    10.00,
    'ENABLED'
);

INSERT INTO town_pincodes (town_id, pincode) VALUES
    ('a1111111-1111-4111-8111-111111111111', '522601'),
    ('a1111111-1111-4111-8111-111111111111', '522603');

INSERT INTO town_config (town_id, config_key, config_value) VALUES (
    'a1111111-1111-4111-8111-111111111111',
    'operational',
    '{
        "minOrderValue": 199,
        "readyForPickupAlertHours": 1,
        "refundWorkingDays": 5,
        "maxSmsPerOrder": 6,
        "quietHours": { "start": "22:00", "end": "08:00" }
    }'::jsonb
);
