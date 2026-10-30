export const BEAUTY_OCCASIONS = [
  { id: 'EVERYDAY', label: 'Everyday', emoji: '☀️', tint: '#FFF7ED' },
  { id: 'OFFICE', label: 'Office ready', emoji: '💼', tint: '#F0F9FF' },
  { id: 'PARTY', label: 'Party glam', emoji: '✨', tint: '#FDF2F8' },
  { id: 'ENGAGEMENT', label: 'Engagement', emoji: '💍', tint: '#F5F3FF' },
  { id: 'BRIDAL', label: 'Bridal', emoji: '👰', tint: '#FFF1F2' },
  { id: 'FESTIVE', label: 'Festive', emoji: '🪔', tint: '#FFFBEB' },
] as const;

export type BeautyOccasionId = (typeof BEAUTY_OCCASIONS)[number]['id'];

export const BEAUTY_SERVICES = [
  {
    id: 'NATURAL_GLOW',
    label: 'Natural glow',
    hint: 'Soft, fresh finish · ~45 min',
    emoji: '🌸',
    defaultMinutes: 45,
  },
  {
    id: 'PARTY_GLAM',
    label: 'Party glam',
    hint: 'Bold eyes & contour · ~75 min',
    emoji: '💄',
    defaultMinutes: 75,
  },
  {
    id: 'HD_CAMERA',
    label: 'HD / camera ready',
    hint: 'Long-wear base · ~90 min',
    emoji: '📸',
    defaultMinutes: 90,
  },
  {
    id: 'BRIDAL_FULL',
    label: 'Bridal makeup',
    hint: 'Full ceremony look · ~120 min',
    emoji: '👰',
    defaultMinutes: 120,
  },
  {
    id: 'HAIR_STYLING',
    label: 'Hair styling',
    hint: 'Blow-dry or updo · ~60 min',
    emoji: '💇',
    defaultMinutes: 60,
  },
  {
    id: 'SAREE_DRAPE',
    label: 'Saree drape',
    hint: 'Pleats & pin help · ~30 min',
    emoji: '🥻',
    defaultMinutes: 30,
  },
  {
    id: 'MEHENDI',
    label: 'Mehendi (hands)',
    hint: 'Classic bridal hands · ~90 min',
    emoji: '🌿',
    defaultMinutes: 90,
  },
  {
    id: 'MANICURE',
    label: 'Manicure',
    hint: 'Hands & nails · ~45 min',
    emoji: '💅',
    defaultMinutes: 45,
  },
  {
    id: 'PEDICURE',
    label: 'Pedicure',
    hint: 'Feet & nails · ~60 min',
    emoji: '🦶',
    defaultMinutes: 60,
  },
  {
    id: 'FACIAL',
    label: 'Facial',
    hint: 'Cleanse & glow · ~60 min',
    emoji: '🧖',
    defaultMinutes: 60,
  },
  {
    id: 'THREADING',
    label: 'Threading',
    hint: 'Brow & face · ~20 min',
    emoji: '✨',
    defaultMinutes: 20,
  },
  {
    id: 'WAXING',
    label: 'Waxing',
    hint: 'Smooth skin · ~30 min',
    emoji: '🌟',
    defaultMinutes: 30,
  },
] as const;

export const BEAUTY_SERVICE_CATEGORIES = [
  {
    id: 'MAKEUP',
    label: 'Makeup',
    emoji: '💄',
    serviceIds: ['NATURAL_GLOW', 'PARTY_GLAM', 'HD_CAMERA', 'BRIDAL_FULL'],
  },
  {
    id: 'HAIR',
    label: 'Hair & drape',
    emoji: '💇',
    serviceIds: ['HAIR_STYLING', 'SAREE_DRAPE'],
  },
  {
    id: 'HANDS',
    label: 'Hands & feet',
    emoji: '💅',
    serviceIds: ['MEHENDI', 'MANICURE', 'PEDICURE'],
  },
  {
    id: 'SKIN',
    label: 'Skin',
    emoji: '🧖',
    serviceIds: ['FACIAL', 'THREADING', 'WAXING'],
  },
] as const;

export type BeautyServiceCategoryId = (typeof BEAUTY_SERVICE_CATEGORIES)[number]['id'];

export type BeautyServiceId = (typeof BEAUTY_SERVICES)[number]['id'];

export function beautyServicesInCategory(
  categoryId: BeautyServiceCategoryId,
): Array<(typeof BEAUTY_SERVICES)[number]> {
  const row = BEAUTY_SERVICE_CATEGORIES.find((c) => c.id === categoryId);
  if (!row) return [...BEAUTY_SERVICES];
  const ids = new Set<string>(row.serviceIds);
  return BEAUTY_SERVICES.filter((s) => ids.has(s.id));
}

export const BEAUTY_VENUES = [
  { id: 'AT_HOME', label: 'At my home', emoji: '🏠', hint: 'Artist travels to you' },
  { id: 'AT_STUDIO', label: 'At the studio', emoji: '🪞', hint: 'Visit the artist’s space' },
] as const;

export type BeautyVenueId = (typeof BEAUTY_VENUES)[number]['id'];

export function beautyOccasionLabel(id: string): string {
  return BEAUTY_OCCASIONS.find((row) => row.id === id)?.label ?? id;
}

export function beautyServiceLabel(id: string): string {
  const found = BEAUTY_SERVICES.find((row) => row.id === id);
  if (found) return found.label;
  if (id.startsWith('CUS_')) {
    return id
      .slice(4)
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }
  return id;
}

export function slugCustomTreatmentCode(label: string): string {
  const slug = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 26);
  return `CUS_${slug || 'TREATMENT'}`;
}

export function beautyVenueLabel(id: string): string {
  return BEAUTY_VENUES.find((row) => row.id === id)?.label ?? id;
}
