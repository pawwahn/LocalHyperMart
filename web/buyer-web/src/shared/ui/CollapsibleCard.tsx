import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

export function CollapsibleCard({
  title,
  summary,
  defaultExpanded = false,
  children,
  cardStyle,
}: {
  title: string;
  summary?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
  cardStyle?: CSSProperties;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const line = useMemo(() => summary?.trim() || '', [summary]);

  return (
    <section style={{ ...styles.wrap, ...cardStyle }}>
      <button type="button" style={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
        <div style={styles.toggleText}>
          <span style={styles.title}>{title}</span>
          {!expanded && line ? <span style={styles.summary}>{line}</span> : null}
        </div>
        <span style={styles.chevron} aria-hidden>
          {expanded ? '▴' : '▾'}
        </span>
      </button>
      {expanded ? <div style={styles.body}>{children}</div> : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.45rem' },
  toggle: {
    appearance: 'none',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    borderRadius: 16,
    background: 'var(--bg-elevated)',
    padding: '0.62rem 0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.65rem',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: 'var(--shadow-card)',
  },
  toggleText: { display: 'grid', gap: '0.15rem', minWidth: 0, flex: 1 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '0.92rem',
    fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  summary: {
    color: 'var(--text-muted)',
    fontSize: '0.84rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    color: 'var(--accent)',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
  },
  body: {
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    borderRadius: 16,
    background: 'var(--bg-elevated)',
    padding: '0.65rem 0.75rem',
    boxShadow: 'var(--shadow-card)',
  },
};
