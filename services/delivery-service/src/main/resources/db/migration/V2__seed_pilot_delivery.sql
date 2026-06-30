INSERT INTO delivery_hubs (
    id, town_id, name, address, phone, status
) VALUES (
    'd1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    'Narsaraopet Hub',
    'Bus Stand Road, Narsaraopet',
    '9876500100',
    'ACTIVE'
);

INSERT INTO hub_admins (hub_id, user_id, status)
VALUES (
    'd1111111-1111-4111-8111-111111111111',
    '00000000-0000-4000-8000-000000000201',
    'ACTIVE'
);

INSERT INTO delivery_agents (
    id, user_id, name, phone, status
) VALUES (
    'e1111111-1111-4111-8111-111111111111',
    '00000000-0000-4000-8000-000000000301',
    'Raju Delivery',
    '9876500200',
    'ACTIVE'
);

INSERT INTO agent_hub_links (agent_id, hub_id, town_id, active)
VALUES (
    'e1111111-1111-4111-8111-111111111111',
    'd1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    TRUE
);
