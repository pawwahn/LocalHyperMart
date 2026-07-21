-- Second pilot delivery agent (password: "password") for multi-agent hub assign demos
INSERT INTO users (
    id, phone, password_hash, first_name, last_name, status
) VALUES (
    '00000000-0000-4000-8000-000000000302',
    '9876500201',
    '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
    'Suresh',
    'Boy',
    'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, town_id, agent_id)
SELECT '00000000-0000-4000-8000-000000000302', r.id, 'a1111111-1111-4111-8111-111111111111', 'e2222222-2222-4222-8222-222222222222'
FROM roles r
WHERE r.name = 'DELIVERY_AGENT'
  AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = '00000000-0000-4000-8000-000000000302'
        AND ur.role_id = r.id
  );
