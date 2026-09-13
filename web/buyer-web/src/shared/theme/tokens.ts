/** Design tokens — Instamart / Zepto / Blinkit grocery light skin. */
export const tokens = {
  color: {
    bg: '#F4F6F5',
    bgElevated: '#FFFFFF',
    bgMuted: '#EEF1EF',
    bgTint: '#E8F6EC',
    border: '#E4E7EA',
    text: '#1A1C1A',
    textMuted: '#6B7280',
    textInverse: '#FFFFFF',
    accent: '#0C831F',
    accentHover: '#086318',
    accentSoft: '#E7F6EC',
    hero: '#0C831F',
    heroDeep: '#086318',
    highlight: '#F7CE46',
    highlightSoft: '#FFF6CC',
    danger: '#E03546',
    dangerSoft: '#FDE8EA',
    warning: '#F57C00',
    warningSoft: '#FFF3E0',
    info: '#0C831F',
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
    sm: '10px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    full: '999px',
  },
  shadow: {
    card: '0 1px 4px rgba(16, 24, 40, 0.06)',
    elevated: '0 8px 24px rgba(12, 131, 31, 0.14)',
    soft: '0 10px 28px rgba(16, 24, 40, 0.08)',
  },
  motion: {
    fast: '140ms ease',
    normal: '220ms ease',
  },
} as const;

export type Tokens = typeof tokens;
