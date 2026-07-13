/** Design tokens — Blinkit-inspired quick-commerce retail skin. */
export const tokens = {
  color: {
    bg: '#F6F7F9',
    bgElevated: '#FFFFFF',
    bgMuted: '#EEF1F4',
    bgTint: '#E8F6EC',
    border: '#E8E8E8',
    text: '#1C1C1C',
    textMuted: '#757575',
    textInverse: '#FFFFFF',
    accent: '#0C831F',
    accentHover: '#096B19',
    accentSoft: '#E7F6EC',
    highlight: '#F8CB46',
    highlightSoft: '#FFF6D6',
    danger: '#E03546',
    dangerSoft: '#FDE8EA',
    warning: '#F57C00',
    warningSoft: '#FFF3E0',
    info: '#2563EB',
    success: '#0C831F',
    successSoft: '#E7F6EC',
  },
  font: {
    display: '"Outfit", "DM Sans", system-ui, sans-serif',
    body: '"DM Sans", system-ui, sans-serif',
  },
  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    xxl: '1.5rem',
    xxxl: '2rem',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '999px',
  },
  shadow: {
    card: '0 1px 3px rgba(0, 0, 0, 0.06)',
    elevated: '0 8px 24px rgba(12, 131, 31, 0.14)',
    soft: '0 12px 32px rgba(15, 23, 42, 0.1)',
  },
  motion: {
    fast: '120ms ease',
    normal: '180ms ease',
  },
} as const;

export type Tokens = typeof tokens;
