/** Design tokens — quick-commerce retail skin (Gen-Z energy, HLM green). */
export const tokens = {
  color: {
    bg: '#EEF1F4',
    bgElevated: '#FFFFFF',
    bgMuted: '#E2E6EC',
    bgTint: '#E8F6EC',
    border: 'rgba(2, 6, 12, 0.1)',
    text: 'rgba(2, 6, 12, 0.92)',
    textMuted: 'rgba(2, 6, 12, 0.52)',
    textInverse: '#FFFFFF',
    accent: '#0C831F',
    accentHover: '#096B19',
    accentSoft: '#E7F6EC',
    hero: '#0C831F',
    heroDeep: '#086318',
    highlight: '#C8F542',
    highlightSoft: '#F3FFC8',
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
    sm: '10px',
    md: '14px',
    lg: '18px',
    xl: '22px',
    full: '999px',
  },
  shadow: {
    card: '0 2px 12px rgba(27, 30, 36, 0.08)',
    elevated: '0 10px 32px rgba(12, 131, 31, 0.18)',
    soft: '0 14px 40px rgba(2, 6, 12, 0.1)',
  },
  motion: {
    fast: '140ms ease',
    normal: '220ms ease',
  },
} as const;

export type Tokens = typeof tokens;
