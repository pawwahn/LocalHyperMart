import type { CSSProperties } from 'react';

type Props = { label?: string };

export function LoadingBlock({ label = 'Loading…' }: Props) {
  return (
    <div style={styles.wrap} role="status" aria-live="polite">
      <div style={styles.dot} />
      <p style={styles.label}>{label}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: 'grid',
    justifyItems: 'center',
    gap: '0.75rem',
    padding: '2.5rem 1rem',
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-full)',
    border: '3px solid var(--accent-soft)',
    borderTopColor: 'var(--accent)',
    animation: 'hlm-pulse 0.9s ease infinite',
  },
  label: { margin: 0, color: 'var(--text-muted)', fontWeight: 600 },
};
