/** Delivery / hub portal tokens — light ops UI, blue accent. */
export const tokens = {
  color: {
    bg: '#F4F7FB',
    bgElevated: '#FFFFFF',
    bgMuted: '#E8EEF6',
    bgTint: '#DBEAFE',
    border: '#E5E7EB',
    text: '#1A1A1A',
    textMuted: '#6B7280',
    textInverse: '#FFFFFF',
    accent: '#2563EB',
    accentHover: '#1D4ED8',
    accentSoft: '#DBEAFE',
    danger: '#EF4444',
    dangerSoft: '#FEE2E2',
    warning: '#F59E0B',
    warningSoft: '#FEF3C7',
    info: '#0EA5E9',
    success: '#10B981',
    successSoft: '#D1FAE5',
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
    card: '0 2px 8px rgba(0, 0, 0, 0.06)',
    elevated: '0 8px 24px rgba(37, 99, 235, 0.12)',
    soft: '0 14px 40px rgba(15, 23, 42, 0.08)',
  },
  motion: {
    fast: '120ms ease',
    normal: '180ms ease',
  },
} as const;

export type Tokens = typeof tokens;
