/** Design tokens — grocery consumer skin (Instamart / Blinkit bar). */
export const tokens = {
  color: {
    bg: '#F3F4F3',
    bgElevated: '#FFFFFF',
    bgMuted: '#ECEEED',
    bgTint: '#E8F6EC',
    border: '#E0E3E1',
    text: '#141614',
    textMuted: '#5C6560',
    textInverse: '#FFFFFF',
    accent: '#009111',
    accentHover: '#007A0E',
    accentSoft: '#E5F5E7',
    hero: '#009111',
    heroDeep: '#007A0E',
    highlight: '#F7CE46',
    highlightSoft: '#FFF6CC',
    danger: '#E03546',
    dangerSoft: '#FDE8EA',
    warning: '#F57C00',
    warningSoft: '#FFF3E0',
    info: '#009111',
    success: '#009111',
    successSoft: '#E5F5E7',
  },
  font: {
    display: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    body: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
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
    card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 12px rgba(16, 24, 40, 0.04)',
    elevated: '0 12px 32px rgba(16, 24, 40, 0.1)',
    soft: '0 8px 24px rgba(16, 24, 40, 0.06)',
  },
  motion: {
    fast: '140ms ease',
    normal: '220ms ease',
  },
} as const;

export type Tokens = typeof tokens;
