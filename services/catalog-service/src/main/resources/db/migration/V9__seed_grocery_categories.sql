-- Grocery home categories (Blinkit-style). Idempotent on name.
INSERT INTO categories (id, name, description)
SELECT v.id, v.name, v.description
FROM (VALUES
    ('c9a00000-0001-4000-8000-000000000001'::uuid, 'Fresh Vegetables', 'Onions, tomato, leafy greens and more'),
    ('c9a00000-0002-4000-8000-000000000002'::uuid, 'Fresh Fruits', 'Banana, apple, seasonal fruit'),
    ('c9a00000-0003-4000-8000-000000000003'::uuid, 'Dairy, Bread and Eggs', 'Milk, curd, paneer, bread and eggs'),
    ('c9a00000-0004-4000-8000-000000000004'::uuid, 'Rice, Atta and Dals', 'Rice, wheat flour and pulses'),
    ('c9a00000-0005-4000-8000-000000000005'::uuid, 'Oils and Ghee', 'Cooking oil, ghee and vanaspati'),
    ('c9a00000-0006-4000-8000-000000000006'::uuid, 'Masalas and Dry Fruits', 'Spices, nuts and dry fruits'),
    ('c9a00000-0007-4000-8000-000000000007'::uuid, 'Munchies', 'Chips, namkeen and popcorn'),
    ('c9a00000-0008-4000-8000-000000000008'::uuid, 'Sweet Tooth', 'Chocolates, sweets and ice cream'),
    ('c9a00000-0009-4000-8000-000000000009'::uuid, 'Cold Drinks and Juices', 'Soft drinks, juice and soda'),
    ('c9a00000-0010-4000-8000-000000000010'::uuid, 'Biscuits and Cakes', 'Biscuits, cookies, rusk and cakes'),
    ('c9a00000-0011-4000-8000-000000000011'::uuid, 'Instant and Frozen Food', 'Noodles, ready meals and frozen'),
    ('c9a00000-0012-4000-8000-000000000012'::uuid, 'Meat and Seafood', 'Chicken, mutton, fish and eggs'),
    ('c9a00000-0013-4000-8000-000000000013'::uuid, 'Cereals and Breakfast', 'Oats, muesli and breakfast mixes'),
    ('c9a00000-0014-4000-8000-000000000014'::uuid, 'Sauces and Spreads', 'Ketchup, jam, mayonnaise and sauces'),
    ('c9a00000-0015-4000-8000-000000000015'::uuid, 'Tea, Coffee and More', 'Tea, coffee and health drinks'),
    ('c9a00000-0016-4000-8000-000000000016'::uuid, 'Cleaning Essentials', 'Detergents, cleaners and dishwash'),
    ('c9a00000-0017-4000-8000-000000000017'::uuid, 'Pharma and Hygiene', 'Pharmacy, sanitizer and hygiene'),
    ('c9a00000-0018-4000-8000-000000000018'::uuid, 'Bath, Body and Hair', 'Soap, shampoo and body care'),
    ('c9a00000-0019-4000-8000-000000000019'::uuid, 'Beauty and Grooming', 'Makeup, skincare and grooming'),
    ('c9a00000-0020-4000-8000-000000000020'::uuid, 'Baby Care', 'Baby food, diapers and care'),
    ('c9a00000-0021-4000-8000-000000000021'::uuid, 'Pet Supplies', 'Pet food and accessories'),
    ('c9a00000-0022-4000-8000-000000000022'::uuid, 'Home and Kitchen', 'Kitchen, dining and home needs'),
    ('c9a00000-0023-4000-8000-000000000023'::uuid, 'Office and Electricals', 'Stationery, bulbs and electricals'),
    ('c9a00000-0024-4000-8000-000000000024'::uuid, 'Paan Corner', 'Paan, smoking essentials')
) AS v(id, name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE lower(btrim(c.name)) = lower(btrim(v.name))
);
