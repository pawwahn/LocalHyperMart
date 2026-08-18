import { getAccent, MODE_PRESETS, type ThemeMode, type ThemePreference } from './presets';
import { loadThemePreference } from './storage';
import type { AccentId } from './presets';

const STYLE_ID = 'hlm-theme-vars';

export function applyTheme(preference: ThemePreference): void {
  const mode = MODE_PRESETS[preference.mode];
  const accent = getAccent(preference.accent);
  const soft = preference.mode === 'dark' ? accent.accentSoftDark : accent.accentSoftLight;
  const tint = soft;
  const elevatedShadow =
    preference.mode === 'dark'
      ? `0 8px 24px rgba(${accent.rgb}, 0.28)`
      : `0 8px 24px rgba(${accent.rgb}, 0.14)`;

  const css = `
    :root {
      --bg: ${mode.bg};
      --bg-elevated: ${mode.bgElevated};
      --bg-muted: ${mode.bgMuted};
      --bg-tint: ${tint};
      --border: ${mode.border};
      --text: ${mode.text};
      --text-muted: ${mode.textMuted};
      --text-inverse: ${mode.textInverse};
      --accent: ${accent.accent};
      --accent-hover: ${accent.accentHover};
      --accent-soft: ${soft};
      --accent-rgb: ${accent.rgb};
      --highlight: ${accent.accent};
      --highlight-soft: ${soft};
      /* Keep semantic greens independent of accent picker (hub "Bag reached hub" CTA, etc.) */
      --success: ${preference.mode === 'dark' ? '#34D399' : '#10B981'};
      --success-soft: ${preference.mode === 'dark' ? 'rgba(52, 211, 153, 0.18)' : '#D1FAE5'};
      --danger: ${preference.mode === 'dark' ? '#F87171' : '#EF4444'};
      --danger-soft: ${preference.mode === 'dark' ? 'rgba(248, 113, 113, 0.18)' : '#FEE2E2'};
      --warning: ${preference.mode === 'dark' ? '#FBBF24' : '#F59E0B'};
      --warning-soft: ${preference.mode === 'dark' ? 'rgba(251, 191, 36, 0.18)' : '#FEF3C7'};
      --shadow-elevated: ${elevatedShadow};
      color-scheme: ${preference.mode};
    }
    body {
      background: ${
        preference.mode === 'dark'
          ? 'var(--bg)'
          : `radial-gradient(ellipse at 12% -10%, rgba(${accent.rgb}, 0.11), transparent 42%),
        radial-gradient(ellipse at 90% 10%, rgba(${accent.rgb}, 0.06), transparent 38%),
        var(--bg)`
      } !important;
      color: var(--text);
    }
  `;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
  document.documentElement.dataset.themeMode = preference.mode;
  document.documentElement.dataset.themeAccent = preference.accent;
}

export function applyStoredTheme(
  storageKey: string,
  defaultAccent: AccentId,
  defaultMode: ThemeMode = 'light',
): ThemePreference {
  const preference = loadThemePreference(storageKey, defaultAccent, defaultMode);
  applyTheme(preference);
  return preference;
}
