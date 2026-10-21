/// <reference types="vite/client" />

const files = import.meta.glob('./images/*.png', { eager: true, import: 'default' }) as Record<string, string>;

function photo(id: string): string {
  const value = files[`./images/${id}.png`];
  return typeof value === 'string' ? value : '';
}

export const LAUNDRY_SERVICES = [
  { id: 'WASH_AND_IRON', label: 'Wash + iron' },
  { id: 'WASH_ONLY', label: 'Wash' },
  { id: 'IRON_ONLY', label: 'Iron' },
] as const;

export const LAUNDRY_ITEMS = [
  { id: 'SAREE', label: 'Saree', tint: '#FDE7F3' },
  { id: 'SHIRT', label: 'Shirt', tint: '#E7F1FF' },
  { id: 'PANTS', label: 'Pants', tint: '#E8F7EE' },
  { id: 'CURTAINS', label: 'Curtains', tint: '#F3E8FF' },
  { id: 'BEDSHEET', label: 'Bed sheet', tint: '#FFF4E5' },
  { id: 'TOWEL', label: 'Towel', tint: '#E6F7F7' },
  { id: 'PILLOW_COVER', label: 'Pillow cover', tint: '#F7F3EA' },
  { id: 'BLANKET', label: 'Blanket / quilt', tint: '#EDE8E1' },
  { id: 'SHERWANI', label: 'Sherwani', tint: '#FFF6E8' },
  { id: 'LEHENGA', label: 'Lehenga', tint: '#FDE8F0' },
  { id: 'SUIT', label: 'Suit & blazer', tint: '#E8EEF7' },
  { id: 'SALWAR_SUIT', label: 'Salwar suit', tint: '#FCE8F2' },
  { id: 'KURTA', label: 'Kurta', tint: '#F3F0E8' },
  { id: 'T_SHIRT', label: 'T-shirt', tint: '#EEF2F6' },
  { id: 'HOODIE', label: 'Sweatshirt / hoodie', tint: '#E7F3EA' },
  { id: 'JACKET', label: 'Jacket / coat', tint: '#E8EEF4' },
  { id: 'SWEATER', label: 'Sweater', tint: '#F4EEE6' },
  { id: 'DRESS', label: 'Dress', tint: '#FDECE8' },
  { id: 'KIDS_WEAR', label: 'Kids wear', tint: '#E7F3FF' },
  { id: 'BLOUSE', label: 'Blouse', tint: '#FCE8F0' },
  { id: 'DHOTI', label: 'Dhoti / vesti', tint: '#F7F3E4' },
  { id: 'NIGHTWEAR', label: 'Nightwear', tint: '#E8EEF8' },
  { id: 'UNDERGARMENT', label: 'Undergarment', tint: '#F4EDE8' },
  { id: 'TABLE_CLOTH', label: 'Table cloth', tint: '#F3EFE4' },
  { id: 'CUSHION_COVER', label: 'Cushion cover', tint: '#F0EBE3' },
  { id: 'SOFT_TOY', label: 'Soft toy', tint: '#F8EFE4' },
  { id: 'OTHER', label: 'Other', tint: '#F4F4F5' },
].map((item) => ({ ...item, image: photo(item.id) }));

export type LaundryItemId = (typeof LAUNDRY_ITEMS)[number]['id'];
