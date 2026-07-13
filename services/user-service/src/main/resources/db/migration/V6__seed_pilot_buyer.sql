-- Pilot buyer for local E2E (password: "password" — same hash as other pilot users)
INSERT INTO users (
    id, phone, password_hash, first_name, last_name, status, default_town_id
) VALUES (
    '00000000-0000-4000-8000-000000000401',
    '9876511111',
    '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
    'Test',
    'Buyer',
    'ACTIVE',
    'a1111111-1111-4111-8111-111111111111'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, town_id)
SELECT u.id, r.id, 'a1111111-1111-4111-8111-111111111111'
FROM users u
CROSS JOIN roles r
WHERE u.phone = '9876511111'
  AND r.name = 'BUYER'
  AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );
