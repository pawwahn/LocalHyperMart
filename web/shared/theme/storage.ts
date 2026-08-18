import type { AccentId, ThemeMode, ThemePreference } from './presets';

const ACCENTS = new Set<AccentId>([
  'forest',
  'ocean',
  'amber',
  'berry',
  'teal',
  'slate',
  'coral',
]);

export function loadThemePreference(
  storageKey: string,
  defaultAccent: AccentId,
  defaultMode: ThemeMode = 'light',
): ThemePreference {
  const fallback: ThemePreference = { mode: defaultMode, accent: defaultAccent };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ThemePreference>;
    const mode: ThemeMode =
      parsed.mode === 'dark' || parsed.mode === 'light' ? parsed.mode : defaultMode;
    const accent =
      parsed.accent && ACCENTS.has(parsed.accent) ? parsed.accent : defaultAccent;
    return { mode, accent };
  } catch {
    return fallback;
  }
}

export function saveThemePreference(storageKey: string, preference: ThemePreference): void {
  localStorage.setItem(storageKey, JSON.stringify(preference));
}
