-- Chirala delivery hub (town id = existing Chirala in town-service).
-- Hub admin login: 9876511111 (user-service V9). hub_admins.user_id is reconciled
-- on first hub login via phone if seed user id differs; seed uses fixed id when free.

INSERT INTO delivery_hubs (
    id, town_id, name, address, phone, status
) VALUES (
    'd2222222-2222-4222-8222-222222222222',
    'a8e7366c-2bd8-4376-b18b-7ba110f4d69f',
    'Chirala Hub',
    'Chirala town hub',
    '9876511111',
    'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

-- Prefer fixed seed user id; live DBs may rewrite this to the phone's real user id.
INSERT INTO hub_admins (hub_id, user_id, status)
VALUES (
    'd2222222-2222-4222-8222-222222222222',
    '00000000-0000-4000-8000-000000000202',
    'ACTIVE'
)
ON CONFLICT (hub_id) DO NOTHING;
