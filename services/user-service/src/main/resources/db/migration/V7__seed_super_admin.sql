-- Pilot super admin (password: "password" — same BCrypt as other pilot users)
INSERT INTO users (
    id, phone, password_hash, first_name, last_name, status
) VALUES
    (
        '00000000-0000-4000-8000-000000000001',
        '9876500900',
        '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
        'Platform',
        'Admin',
        'ACTIVE'
    );

INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-4000-8000-000000000001', id
FROM roles WHERE name = 'SUPER_ADMIN';
