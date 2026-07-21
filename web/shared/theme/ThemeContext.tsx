import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { applyTheme } from './applyTheme';
import type { AccentId, ThemeMode, ThemePreference } from './presets';
import { loadThemePreference, saveThemePreference } from './storage';

type ThemeContextValue = {
  preference: ThemePreference;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type Props = {
  storageKey: string;
  defaultAccent: AccentId;
  children: ReactNode;
};

export function ThemeProvider({ storageKey, defaultAccent, children }: Props) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    loadThemePreference(storageKey, defaultAccent),
  );

  const commit = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      saveThemePreference(storageKey, next);
      applyTheme(next);
    },
    [storageKey],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setMode: (mode) => commit({ ...preference, mode }),
      setAccent: (accent) => commit({ ...preference, accent }),
      setPreference: commit,
    }),
    [preference, commit],
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
