import type { CSSProperties } from 'react';

export const agentTripSegment: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 5,
  padding: 5,
  borderRadius: 14,
  background: 'color-mix(in srgb, var(--bg-muted) 85%, var(--bg-elevated))',
  border: '1px solid color-mix(in srgb, var(--border) 85%, transparent)',
  boxShadow: 'var(--shadow-soft)',
};

export const agentTripChip: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '0.5rem 0.35rem',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.76rem',
  fontWeight: 700,
  cursor: 'pointer',
  minHeight: 40,
  fontFamily: 'var(--font-display)',
};

export const agentTripChipActive: CSSProperties = {
  ...agentTripChip,
  background: 'var(--bg-elevated)',
  color: 'var(--accent)',
  fontWeight: 800,
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.07)',
};

export const agentTripSearchWrap: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

export const agentTripSearchIcon: CSSProperties = {
  position: 'absolute',
  left: 12,
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
  pointerEvents: 'none',
};

export const agentTripSearch: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid color-mix(in srgb, var(--border) 90%, transparent)',
  borderRadius: 14,
  padding: '0.62rem 0.75rem 0.62rem 2.15rem',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  fontSize: '0.88rem',
  fontWeight: 600,
  boxShadow: 'var(--shadow-soft)',
};
