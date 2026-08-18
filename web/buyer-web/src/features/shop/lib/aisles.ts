const EMOJI_RULES: Array<[RegExp, string]> = [
  [/vegetab/i, '🥦'],
  [/fruit/i, '🍎'],
  [/dairy|bread|egg/i, '🥚'],
  [/munchie|snack/i, '🍿'],
  [/sweet|chocolate|ice cream/i, '🍫'],
  [/biscuit|cake/i, '🍪'],
  [/drink|juice|soda/i, '🧃'],
  [/instant|frozen|noodle/i, '🍜'],
  [/masala|dry fruit/i, '🥜'],
  [/cereal|breakfast/i, '🥣'],
  [/sauce|spread/i, '🍅'],
  [/tea|coffee/i, '☕'],
  [/rice|atta|dal/i, '🌾'],
  [/oil|ghee/i, '🫙'],
  [/meat|seafood|fish/i, '🍗'],
  [/baby/i, '🍼'],
  [/beauty|grooming/i, '💄'],
  [/bath|hair|body/i, '🧼'],
  [/pharma|hygiene/i, '💊'],
  [/clean/i, '🧹'],
  [/home|kitchen/i, '🍽️'],
  [/office|electric/i, '💡'],
  [/pet/i, '🐾'],
  [/paan|smok/i, '🍃'],
  [/groc/i, '🛒'],
];

export function emojiForCategory(name: string): string {
  for (const [pattern, emoji] of EMOJI_RULES) {
    if (pattern.test(name)) return emoji;
  }
  return '🛒';
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
