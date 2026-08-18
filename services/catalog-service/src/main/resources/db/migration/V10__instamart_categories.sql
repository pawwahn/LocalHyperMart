-- Instamart-style grocery aisles. Rename V9 combined names where free, then insert missing ones.

UPDATE categories AS c
SET name = 'Atta, Rice and Dal',
    description = 'Atta, rice and dals',
    updated_at = NOW()
WHERE lower(btrim(c.name)) = 'rice, atta and dals'
  AND NOT EXISTS (
      SELECT 1 FROM categories c2
      WHERE lower(btrim(c2.name)) = 'atta, rice and dal'
        AND c2.id <> c.id
  );

UPDATE categories AS c
SET name = 'Tea, Coffee and Milk drinks',
    description = 'Tea, coffee and milk drinks',
    updated_at = NOW()
WHERE lower(btrim(c.name)) = 'tea, coffee and more'
  AND NOT EXISTS (
      SELECT 1 FROM categories c2
      WHERE lower(btrim(c2.name)) = 'tea, coffee and milk drinks'
        AND c2.id <> c.id
  );

UPDATE categories AS c
SET name = 'Chips and Namkeens',
    description = 'Chips, namkeen and munchies',
    updated_at = NOW()
WHERE lower(btrim(c.name)) = 'munchies'
  AND NOT EXISTS (
      SELECT 1 FROM categories c2
      WHERE lower(btrim(c2.name)) = 'chips and namkeens'
        AND c2.id <> c.id
  );

UPDATE categories AS c
SET name = 'Cleaners and Repellents',
    description = 'Detergents, cleaners and repellents',
    updated_at = NOW()
WHERE lower(btrim(c.name)) = 'cleaning essentials'
  AND NOT EXISTS (
      SELECT 1 FROM categories c2
      WHERE lower(btrim(c2.name)) = 'cleaners and repellents'
        AND c2.id <> c.id
  );

UPDATE categories AS c
SET name = 'Electronics and Appliances',
    description = 'Electronics, bulbs and appliances',
    updated_at = NOW()
WHERE lower(btrim(c.name)) = 'office and electricals'
  AND NOT EXISTS (
      SELECT 1 FROM categories c2
      WHERE lower(btrim(c2.name)) = 'electronics and appliances'
        AND c2.id <> c.id
  );

UPDATE categories AS c
SET name = 'Masalas',
    description = 'Spices and masalas',
    updated_at = NOW()
WHERE lower(btrim(c.name)) = 'masalas and dry fruits'
  AND NOT EXISTS (
      SELECT 1 FROM categories c2
      WHERE lower(btrim(c2.name)) = 'masalas'
        AND c2.id <> c.id
  );

UPDATE categories AS c
SET name = 'Bath and Body',
    description = 'Soap, body wash and bath',
    updated_at = NOW()
WHERE lower(btrim(c.name)) = 'bath, body and hair'
  AND NOT EXISTS (
      SELECT 1 FROM categories c2
      WHERE lower(btrim(c2.name)) = 'bath and body'
        AND c2.id <> c.id
  );

INSERT INTO categories (id, name, description)
SELECT v.id, v.name, v.description
FROM (VALUES
    ('c9a00000-0025-4000-8000-000000000025'::uuid, 'Ice Creams and Frozen Desserts', 'Ice cream, kulfi and frozen desserts'),
    ('c9a00000-0026-4000-8000-000000000026'::uuid, 'Chocolates', 'Chocolates and gift packs'),
    ('c9a00000-0027-4000-8000-000000000027'::uuid, 'Sweet Corner', 'Mithai and Indian sweets'),
    ('c9a00000-0028-4000-8000-000000000028'::uuid, 'Noodles, Pasta, Vermicelli', 'Noodles, pasta and vermicelli'),
    ('c9a00000-0029-4000-8000-000000000029'::uuid, 'Frozen Food', 'Frozen snacks and ready meals'),
    ('c9a00000-0030-4000-8000-000000000030'::uuid, 'Dry Fruits and Seeds Mix', 'Almonds, cashews and seeds'),
    ('c9a00000-0031-4000-8000-000000000031'::uuid, 'Hair Care', 'Shampoo, oil and hair colour'),
    ('c9a00000-0032-4000-8000-000000000032'::uuid, 'Skin Care', 'Face wash, cream and lotion'),
    ('c9a00000-0033-4000-8000-000000000033'::uuid, 'Makeup', 'Compact, lipstick and makeup'),
    ('c9a00000-0034-4000-8000-000000000034'::uuid, 'Hygiene & Personal Care', 'Pads, intimate care and hygiene'),
    ('c9a00000-0035-4000-8000-000000000035'::uuid, 'Sexual Wellness', 'Sexual wellness essentials'),
    ('c9a00000-0036-4000-8000-000000000036'::uuid, 'Health and Nutrition', 'Supplements, OTC and nutrition'),
    ('c9a00000-0037-4000-8000-000000000037'::uuid, 'Puja Store', 'Puja items and incense'),
    ('c9a00000-0038-4000-8000-000000000038'::uuid, 'Toys and Stationery', 'Toys, books and stationery'),
    ('c9a00000-0039-4000-8000-000000000039'::uuid, 'Fashion', 'Apparel and accessories'),
    ('c9a00000-0040-4000-8000-000000000040'::uuid, 'Sports and Fitness', 'Sports and fitness gear')
) AS v(id, name, description)
WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE lower(btrim(c.name)) = lower(btrim(v.name))
);
