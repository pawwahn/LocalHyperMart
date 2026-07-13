/** Lightweight product visual cues when catalog has no imageUrl yet. */

const RULES: Array<{ match: RegExp; emoji: string; tint: string }> = [
  { match: /tomato|onion|potato|carrot|spinach|cucumber|chilli|lemon|veg|cabbage|beans|gourd/i, emoji: '🥦', tint: '#E8F5E9' },
  { match: /milk|curd|paneer|butter|cheese|dairy|ghee/i, emoji: '🥛', tint: '#E3F2FD' },
  { match: /rice|atta|flour|dal|pulse|wheat|grain|basmati/i, emoji: '🌾', tint: '#FFF8E1' },
  { match: /oil|soap|detergent|clean|shampoo|toothpaste/i, emoji: '🧴', tint: '#E0F7FA' },
  { match: /biscuit|snack|chips|namkeen|cookie|chocolate/i, emoji: '🍪', tint: '#FCE4EC' },
  { match: /tea|coffee|juice|cola|soda|water|drink/i, emoji: '🧃', tint: '#FFF3E0' },
  { match: /egg|chicken|meat|fish|mutton/i, emoji: '🥚', tint: '#FFEBEE' },
  { match: /fruit|apple|banana|mango|orange|grape/i, emoji: '🍎', tint: '#F3E5F5' },
  { match: /bread|bun|pav|bakery/i, emoji: '🍞', tint: '#EFEBE9' },
];

export function productVisual(name: string): { emoji: string; tint: string } {
  for (const rule of RULES) {
    if (rule.match.test(name)) return { emoji: rule.emoji, tint: rule.tint };
  }
  return { emoji: '🛒', tint: '#E8F6EC' };
}
