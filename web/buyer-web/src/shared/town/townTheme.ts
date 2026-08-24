export const DEFAULT_TOWN_THEME = '#0C831F';
export const DEFAULT_DEAL_PRICES = [19, 29, 49, 99];

export function parseDealPrices(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length !== 4) return DEFAULT_DEAL_PRICES;
  const nums = raw.map((item) => {
    const n = typeof item === 'number' ? item : Number(item);
    return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 0;
  });
  return nums.every((n) => n >= 1) ? nums : DEFAULT_DEAL_PRICES;
}

export function contrastOnTheme(hex: string): string {
  const n = hex.replace('#', '');
  if (n.length !== 6) return '#fff';
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#111' : '#fff';
}

export function applyTownTheme(hex: string): void {
  const color = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : DEFAULT_TOWN_THEME;
  document.documentElement.style.setProperty('--town-theme', color);
  document.documentElement.style.setProperty('--town-theme-ink', contrastOnTheme(color));
}
