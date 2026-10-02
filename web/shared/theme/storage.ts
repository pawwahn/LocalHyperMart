import type { AccentId, ThemeMode, ThemePreference } from './presets';

export function loadThemePreference(
  storageKey: string,
  _defaultAccent: AccentId,
  defaultMode: ThemeMode = 'light',
): ThemePreference {
  const fallback: ThemePreference = { mode: defaultMode, accent: 'forest' };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ThemePreference>;
    const mode: ThemeMode =
      parsed.mode === 'dark' || parsed.mode === 'light' ? parsed.mode : defaultMode;
    return { mode, accent: 'forest' };
  } catch {
    return fallback;
  }
}

export function saveThemePreference(storageKey: string, preference: ThemePreference): void {
  localStorage.setItem(storageKey, JSON.stringify({ ...preference, accent: 'forest' }));
}
