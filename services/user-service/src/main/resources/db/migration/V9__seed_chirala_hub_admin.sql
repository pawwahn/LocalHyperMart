-- Chirala hub admin phone 9876511111 (password: "password" when newly created).
-- Town/hub IDs match delivery-service V8__seed_chirala_hub.sql.
-- If the phone already exists (e.g. registered as BUYER), attach HUB_ADMIN to that user.

INSERT INTO users (
    id, phone, password_hash, first_name, last_name, status
)
SELECT
    '00000000-0000-4000-8000-000000000202',
    '9876511111',
    '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
    'Chirala',
    'Hub',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM users
    WHERE phone = '9876511111'
       OR id = '00000000-0000-4000-8000-000000000202'
);

UPDATE users
SET first_name = COALESCE(NULLIF(first_name, ''), 'Chirala'),
    last_name = COALESCE(last_name, 'Hub'),
    updated_at = NOW()
WHERE phone = '9876511111';

INSERT INTO user_roles (user_id, role_id, town_id, hub_id)
SELECT
    u.id,
    r.id,
    'a8e7366c-2bd8-4376-b18b-7ba110f4d69f',
    'd2222222-2222-4222-8222-222222222222'
FROM users u
CROSS JOIN roles r
WHERE u.phone = '9876511111'
  AND r.name = 'HUB_ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = u.id
        AND ur.role_id = r.id
  );
