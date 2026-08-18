import type { CategoryView } from '../api/shopApi';

export type AisleGroup = {
  title: string;
  categories: CategoryView[];
};

type Visual = { icons: string[]; tint: string };

const TINT = '#E8EEF4';

const AISLE_KEYS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'Fresh items',
    keys: [
      'fresh vegetables',
      'vegetables',
      'fresh fruits',
      'dairy, bread and eggs',
      'dairy',
      'meat and seafood',
    ],
  },
  {
    title: 'Grocery & Kitchen',
    keys: [
      'atta, rice and dal',
      'rice, atta and dals',
      'groceries',
      'masalas',
      'oils and ghee',
      'cereals and breakfast',
    ],
  },
  {
    title: 'Snacks & drinks',
    keys: [
      'cold drinks and juices',
      'drinks',
      'ice creams and frozen desserts',
      'chips and namkeens',
      'munchies',
      'snacks',
      'chocolates',
      'biscuits and cakes',
      'tea, coffee and milk drinks',
      'tea, coffee and more',
      'sauces and spreads',
      'sweet corner',
      'sweet tooth',
      'noodles, pasta, vermicelli',
      'frozen food',
      'instant and frozen food',
      'dry fruits and seeds mix',
      'paan corner',
    ],
  },
  {
    title: 'Beauty & Wellness',
    keys: [
      'bath and body',
      'bath, body and hair',
      'hair care',
      'skin care',
      'makeup',
      'beauty and grooming',
      'hygiene & personal care',
      'sexual wellness',
      'health and nutrition',
      'pharma and hygiene',
      'baby care',
    ],
  },
  {
    title: 'Household & Lifestyle',
    keys: [
      'home and kitchen',
      'puja store',
      'cleaners and repellents',
      'cleaning essentials',
      'toys and stationery',
      'electronics and appliances',
      'office and electricals',
      'fashion',
      'pet supplies',
      'sports and fitness',
    ],
  },
];

const VISUALS: Array<[RegExp, Visual]> = [
  [/fresh vegetab|^vegetab/i, { icons: ['🫑', '🌽', '🥬'], tint: '#E7F3EA' }],
  [/fruit/i, { icons: ['🍎', '🍐', '🧺'], tint: '#F3E8EE' }],
  [/dairy|bread|egg/i, { icons: ['🥛', '🍞', '🥚'], tint: '#F4EFE4' }],
  [/meat|seafood|fish/i, { icons: ['🥩', '🐟'], tint: '#F8E8E6' }],
  [/atta|rice|dal/i, { icons: ['🌾', '🍚', '🫘'], tint: '#F3EDE2' }],
  [/masala/i, { icons: ['🌶️', '🫙'], tint: '#F6E8DC' }],
  [/oil|ghee/i, { icons: ['🫙', '🛢️'], tint: '#F7F0D8' }],
  [/cereal|breakfast/i, { icons: ['🥣', '📦'], tint: '#EDE6F3' }],
  [/cold drink|juice|^drinks$/i, { icons: ['🥤', '🧃'], tint: '#E6F0F8' }],
  [/ice cream|frozen dessert/i, { icons: ['🍦', '🍨'], tint: '#F3E7F0' }],
  [/chip|namkeen|munchie|^snacks$/i, { icons: ['🍟', '🥨'], tint: '#F8ECD8' }],
  [/chocolate/i, { icons: ['🍫', '🎁'], tint: '#EFE4D8' }],
  [/biscuit|cake/i, { icons: ['🍪', '🍰'], tint: '#F4E6D8' }],
  [/tea|coffee|milk drink/i, { icons: ['☕', '🍵'], tint: '#EDE6DC' }],
  [/sauce|spread/i, { icons: ['🍯', '🍅'], tint: '#F8E4DC' }],
  [/sweet corner|sweet tooth|mithai/i, { icons: ['🍬', '🥮'], tint: '#F6E8C8' }],
  [/noodle|pasta|vermicelli/i, { icons: ['🍜', '🍝'], tint: '#F8E6D0' }],
  [/frozen food|instant and frozen/i, { icons: ['🧊', '🍟'], tint: '#E4EEF6' }],
  [/dry fruit|seed/i, { icons: ['🥜', '🌰'], tint: '#F3E6D4' }],
  [/paan|smok/i, { icons: ['🍃', '🔥'], tint: '#E8F0E4' }],
  [/bath|body/i, { icons: ['🧴', '🧼'], tint: '#F7EED4' }],
  [/hair/i, { icons: ['💇', '🧴'], tint: '#EDE4F4' }],
  [/skin/i, { icons: ['🧴', '✨'], tint: '#E6F3EA' }],
  [/makeup|beauty|groom/i, { icons: ['💄', '🪞'], tint: '#F6E4EC' }],
  [/hygiene|feminine/i, { icons: ['🩹', '🧴'], tint: '#EDE6F6' }],
  [/sexual/i, { icons: ['❤️', '📦'], tint: '#F8E0E6' }],
  [/health|pharma|nutrition/i, { icons: ['💊', '💪'], tint: '#E6F0F6' }],
  [/baby/i, { icons: ['🍼', '🧷'], tint: '#E8F0F8' }],
  [/home and kitchen|^home|kitchen/i, { icons: ['🍳', '💡'], tint: '#EEE8E0' }],
  [/puja/i, { icons: ['🕉️', '🪔'], tint: '#F8E8C8' }],
  [/cleaner|repellent|cleaning/i, { icons: ['🧴', '🦟'], tint: '#E4EEF6' }],
  [/toy|stationer/i, { icons: ['🧸', '✏️'], tint: '#F4E8D8' }],
  [/electronic|appliance|office|electric/i, { icons: ['🎧', '📱'], tint: '#E6ECF4' }],
  [/fashion/i, { icons: ['👕', '💍'], tint: '#E8EEF6' }],
  [/pet/i, { icons: ['🐶', '🦴'], tint: '#F0E6D8' }],
  [/sport|fitness/i, { icons: ['🎾', '🏋️'], tint: '#E6F2EA' }],
  [/groc/i, { icons: ['🛒', '📦'], tint: TINT }],
];

function norm(name: string) {
  return name.toLowerCase().trim();
}

function aisleSlot(name: string): { aisle: number; order: number } | null {
  const n = norm(name);
  for (let i = 0; i < AISLE_KEYS.length; i++) {
    const order = AISLE_KEYS[i].keys.findIndex((key) => n === key);
    if (order >= 0) return { aisle: i, order };
  }
  return null;
}

export function groupCategoriesIntoAisles(categories: CategoryView[]): AisleGroup[] {
  const buckets: CategoryView[][] = AISLE_KEYS.map(() => []);
  const more: CategoryView[] = [];
  const hidden = new Set(['vegetables', 'groceries', 'dairy', 'snacks', 'drinks']);

  for (const cat of categories) {
    if (hidden.has(norm(cat.name))) continue;
    const slot = aisleSlot(cat.name);
    if (!slot) {
      more.push(cat);
      continue;
    }
    buckets[slot.aisle].push(cat);
  }

  for (let i = 0; i < buckets.length; i++) {
    const keys = AISLE_KEYS[i].keys;
    buckets[i].sort((a, b) => keys.indexOf(norm(a.name)) - keys.indexOf(norm(b.name)));
  }

  const groups: AisleGroup[] = AISLE_KEYS.map((aisle, i) => ({
    title: aisle.title,
    categories: buckets[i],
  })).filter((g) => g.categories.length > 0);

  if (more.length > 0) {
    more.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    groups.push({ title: 'More', categories: more });
  }
  return groups;
}

export function visualForCategory(name: string): Visual {
  for (const [pattern, visual] of VISUALS) {
    if (pattern.test(name)) return visual;
  }
  return { icons: ['🛒'], tint: TINT };
}

export function emojiForCategory(name: string): string {
  return visualForCategory(name).icons[0] ?? '🛒';
}

export function coverImageForCategory(
  categoryId: string,
  categoryName: string,
  items: Array<{ categoryId?: string | null; category?: string | null; imageUrl?: string | null }>,
): string | null {
  const hit = items.find(
    (item) =>
      Boolean(item.imageUrl) &&
      (item.categoryId === categoryId ||
        (item.category ?? '').toLowerCase() === categoryName.toLowerCase()),
  );
  return hit?.imageUrl ?? null;
}
