export type Aisle = {
  id: string;
  label: string;
  emoji: string;
  match?: RegExp;
};

/** Client-side aisle chips until catalog browse exposes categories. */
export const AISLES: Aisle[] = [
  { id: 'all', label: 'All', emoji: '🛒' },
  {
    id: 'veg',
    label: 'Vegetables',
    emoji: '🥦',
    match:
      /tomato|onion|potato|carrot|spinach|cucumber|chilli|lemon|veg|cabbage|beans|gourd|capsicum|brinjal|cauliflower|coriander|ladies|bhindi|cluster/i,
  },
  {
    id: 'dairy',
    label: 'Dairy',
    emoji: '🥛',
    match: /milk|curd|paneer|butter|cheese|dairy|ghee|buttermilk|yogurt|yoghurt/i,
  },
  { id: 'staples', label: 'Staples', emoji: '🌾', match: /rice|atta|flour|dal|pulse|wheat|grain|basmati|oil|sugar/i },
  {
    id: 'snacks',
    label: 'Snacks',
    emoji: '🍪',
    match: /biscuit|snack|chips|namkeen|cookie|chocolate|parle|lays|kurkure|maggi|noodle|chikki|wafer|murukku|murruku|mixture/i,
  },
  {
    id: 'drinks',
    label: 'Drinks',
    emoji: '🧃',
    match: /tea|coffee|juice|cola|soda|water|drink|thums|bisleri|sprite|boost|horlicks|fanta/i,
  },
  { id: 'home', label: 'Home care', emoji: '🧴', match: /soap|detergent|clean|shampoo|toothpaste/i },
];

export function matchesAisle(name: string, aisleId: string): boolean {
  if (aisleId === 'all') return true;
  const aisle = AISLES.find((a) => a.id === aisleId);
  return aisle?.match ? aisle.match.test(name) : true;
}
