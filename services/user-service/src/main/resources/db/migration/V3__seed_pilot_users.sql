-- Pilot dev users (password for all: "password")
-- BCrypt hash generated for Spring BCryptPasswordEncoder strength 10
-- Ravi/Siva user IDs match vendor-service V2__seed_pilot_vendors.sql

INSERT INTO users (
    id, phone, password_hash, first_name, last_name, status
) VALUES
    (
        '00000000-0000-4000-8000-000000000101',
        '9876500001',
        '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
        'Ravi',
        'Kumar',
        'ACTIVE'
    ),
    (
        '00000000-0000-4000-8000-000000000102',
        '9876500002',
        '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
        'Siva',
        'Reddy',
        'ACTIVE'
    ),
    (
        '00000000-0000-4000-8000-000000000201',
        '9876500100',
        '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
        'Hub',
        'Admin',
        'ACTIVE'
    ),
    (
        '00000000-0000-4000-8000-000000000301',
        '9876500200',
        '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG',
        'Delivery',
        'Agent',
        'ACTIVE'
    );

INSERT INTO user_roles (user_id, role_id, town_id, vendor_id)
SELECT '00000000-0000-4000-8000-000000000101', id, 'a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111'
FROM roles WHERE name = 'VENDOR';

INSERT INTO user_roles (user_id, role_id, town_id, vendor_id)
SELECT '00000000-0000-4000-8000-000000000102', id, 'a1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222'
FROM roles WHERE name = 'VENDOR';

INSERT INTO user_roles (user_id, role_id, town_id, hub_id)
SELECT '00000000-0000-4000-8000-000000000201', id, 'a1111111-1111-4111-8111-111111111111', 'd1111111-1111-4111-8111-111111111111'
FROM roles WHERE name = 'HUB_ADMIN';

INSERT INTO user_roles (user_id, role_id, town_id, agent_id)
SELECT '00000000-0000-4000-8000-000000000301', id, 'a1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111'
FROM roles WHERE name = 'DELIVERY_AGENT';
