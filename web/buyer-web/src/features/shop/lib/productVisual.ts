/** Lightweight product visual cues when catalog has no imageUrl yet. */

const RULES: Array<{ match: RegExp; emoji: string; tint: string }> = [
  { match: /tomato|onion|potato|carrot|spinach|cucumber|chilli|lemon|veg|cabbage|beans|gourd/i, emoji: '🥦', tint: 'var(--bg-muted)' },
  { match: /milk|curd|paneer|butter|cheese|dairy|ghee/i, emoji: '🥛', tint: 'var(--bg-muted)' },
  { match: /rice|atta|flour|dal|pulse|wheat|grain|basmati/i, emoji: '🌾', tint: 'var(--bg-muted)' },
  { match: /oil|soap|detergent|clean|shampoo|toothpaste/i, emoji: '🧴', tint: 'var(--bg-muted)' },
  { match: /biscuit|snack|chips|namkeen|cookie|chocolate/i, emoji: '🍪', tint: 'var(--bg-muted)' },
  { match: /tea|coffee|juice|cola|soda|water|drink/i, emoji: '🧃', tint: 'var(--bg-muted)' },
  { match: /egg|chicken|meat|fish|mutton/i, emoji: '🥚', tint: 'var(--bg-muted)' },
  { match: /fruit|apple|banana|mango|orange|grape/i, emoji: '🍎', tint: 'var(--bg-muted)' },
  { match: /bread|bun|pav|bakery/i, emoji: '🍞', tint: 'var(--bg-muted)' },
];

export function productVisual(name: string): { emoji: string; tint: string } {
  for (const rule of RULES) {
    if (rule.match.test(name)) return { emoji: rule.emoji, tint: rule.tint };
  }
  return { emoji: '🛒', tint: 'var(--bg-muted)' };
}
