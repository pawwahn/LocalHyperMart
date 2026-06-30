-- Pilot town: Narsaraopet (matches town-service seed)
INSERT INTO vendors (
    id, town_id, user_id, business_name, owner_name, phone, status
) VALUES
    (
        'b1111111-1111-4111-8111-111111111111',
        'a1111111-1111-4111-8111-111111111111',
        '00000000-0000-4000-8000-000000000101',
        'Ravi Kirana Store',
        'Ravi Kumar',
        '9876500001',
        'ACTIVE'
    ),
    (
        'b2222222-2222-4222-8222-222222222222',
        'a1111111-1111-4111-8111-111111111111',
        '00000000-0000-4000-8000-000000000102',
        'Siva General Store',
        'Siva Reddy',
        '9876500002',
        'ACTIVE'
    );

INSERT INTO shops (
    id, vendor_id, shop_name, address, pincode, status
) VALUES
    (
        'c1111111-1111-4111-8111-111111111111',
        'b1111111-1111-4111-8111-111111111111',
        'Ravi Kirana',
        'Main Road, Narsaraopet',
        '522601',
        'ACTIVE'
    ),
    (
        'c2222222-2222-4222-8222-222222222222',
        'b2222222-2222-4222-8222-222222222222',
        'Siva General Store',
        'Gandhi Nagar, Narsaraopet',
        '522603',
        'ACTIVE'
    );
