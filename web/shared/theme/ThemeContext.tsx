import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applyTheme } from './applyTheme';
import type { AccentId, ThemeMode, ThemePreference } from './presets';
import { loadThemePreference, saveThemePreference } from './storage';

type ThemeContextValue = {
  preference: ThemePreference;
  personalized: boolean;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type Props = {
  storageKey: string;
  defaultAccent: AccentId;
  /**
   * When false, everyone sees the shared default theme (no localStorage).
   * When true (after login), load/save the user's saved preference.
   */
  personalized?: boolean;
  children: ReactNode;
};

function defaultPreference(accent: AccentId): ThemePreference {
  return { mode: 'light', accent };
}

export function ThemeProvider({
  storageKey,
  defaultAccent,
  personalized = true,
  children,
}: Props) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    personalized
      ? loadThemePreference(storageKey, defaultAccent)
      : defaultPreference(defaultAccent),
  );

  useEffect(() => {
    if (personalized) {
      const stored = loadThemePreference(storageKey, defaultAccent);
      setPreferenceState(stored);
      applyTheme(stored);
      return;
    }
    const fallback = defaultPreference(defaultAccent);
    setPreferenceState(fallback);
    applyTheme(fallback);
  }, [personalized, storageKey, defaultAccent]);

  const commit = useCallback(
    (next: ThemePreference) => {
      if (!personalized) return;
      setPreferenceState(next);
      saveThemePreference(storageKey, next);
      applyTheme(next);
    },
    [storageKey, personalized],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      personalized,
      setMode: (mode) => commit({ ...preference, mode }),
      setAccent: (accent) => commit({ ...preference, accent }),
      setPreference: commit,
    }),
    [preference, personalized, commit],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
