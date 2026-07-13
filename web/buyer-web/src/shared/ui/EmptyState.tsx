import type { CSSProperties, ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
};

export function EmptyState({ icon = '🛒', title, description, actionLabel, onAction, children }: Props) {
  return (
    <div style={styles.wrap}>
      <div style={styles.icon} aria-hidden>
        {icon}
      </div>
      <h2 style={styles.title}>{title}</h2>
      {description ? <p style={styles.desc}>{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: 'grid',
    justifyItems: 'center',
    gap: '0.65rem',
    textAlign: 'center',
    padding: '2.5rem 1.25rem',
    background: 'var(--bg-elevated)',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 'var(--radius-full)',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--accent-soft)',
    fontSize: '1.75rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 700,
  },
  desc: { margin: 0, color: 'var(--text-muted)', maxWidth: 360, fontSize: '0.95rem' },
};
