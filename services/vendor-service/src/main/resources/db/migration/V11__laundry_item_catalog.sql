ALTER TABLE laundry_rates DROP CONSTRAINT chk_laundry_item_type;
ALTER TABLE laundry_rates ALTER COLUMN item_type TYPE VARCHAR(40);
ALTER TABLE laundry_rate_history ALTER COLUMN item_type TYPE VARCHAR(40);
ALTER TABLE laundry_rates ADD CONSTRAINT chk_laundry_item_type CHECK (item_type IN (
    'SAREE',
    'SHIRT',
    'PANTS',
    'CURTAINS',
    'BEDSHEET',
    'TOWEL',
    'PILLOW_COVER',
    'BLANKET',
    'SHERWANI',
    'LEHENGA',
    'SUIT',
    'SALWAR_SUIT',
    'KURTA',
    'T_SHIRT',
    'HOODIE',
    'JACKET',
    'SWEATER',
    'DRESS',
    'KIDS_WEAR',
    'BLOUSE',
    'DHOTI',
    'NIGHTWEAR',
    'UNDERGARMENT',
    'TABLE_CLOTH',
    'CUSHION_COVER',
    'SOFT_TOY',
    'OTHER'
));
