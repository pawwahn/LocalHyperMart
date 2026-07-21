INSERT INTO delivery_agents (
    id, user_id, name, phone, status
) VALUES (
    'e2222222-2222-4222-8222-222222222222',
    '00000000-0000-4000-8000-000000000302',
    'Suresh Delivery',
    '9876500201',
    'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_hub_links (agent_id, hub_id, town_id, active)
VALUES (
    'e2222222-2222-4222-8222-222222222222',
    'd1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    TRUE
)
ON CONFLICT (agent_id, hub_id) DO NOTHING;
