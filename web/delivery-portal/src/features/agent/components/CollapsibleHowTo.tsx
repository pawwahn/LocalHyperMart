import { useState, type CSSProperties, type ReactNode } from 'react';

/** Compact, tappable how-to strip — collapsed by default to save screen space. */
export function CollapsibleHowTo({
  summary,
  children,
  storageKey,
}: {
  summary: string;
  children: ReactNode;
  /** Persist open/closed across refreshes when set. */
  storageKey?: string;
}) {
  const [open, setOpen] = useState(() => {
    if (!storageKey || typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(storageKey) === '1';
  });

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) {
        window.sessionStorage.setItem(storageKey, next ? '1' : '0');
      }
      return next;
    });
  }

  return (
    <div style={styles.wrap}>
      <button type="button" style={styles.toggle} onClick={toggle} aria-expanded={open}>
        <span style={styles.summary}>{open ? 'How to' : summary}</span>
        <span style={styles.chevron} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div style={styles.body}>{children}</div> : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    borderRadius: 10,
    background: 'rgba(66, 165, 245, 0.1)',
    border: '1px solid rgba(66, 165, 245, 0.35)',
    overflow: 'hidden',
  },
  toggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    margin: 0,
    padding: '0.45rem 0.7rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 40,
  },
  summary: {
    margin: 0,
    fontWeight: 700,
    fontSize: '0.82rem',
    lineHeight: 1.25,
  },
  chevron: {
    flexShrink: 0,
    fontSize: '0.85rem',
    fontWeight: 800,
    color: 'var(--accent)',
  },
  body: {
    display: 'grid',
    gap: '0.2rem',
    padding: '0 0.7rem 0.5rem',
  },
};
