import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  /** e.g. collection agent — no dispatch permission */
  readOnly?: boolean;
};

/**
 * Shown on Seller home for all diagnostics vendors when the heavy assign block is hidden or unavailable.
 */
export function DiagnosticsHomeSummary({ readOnly }: Props) {
  return (
    <section style={styles.card}>
      <h2 style={styles.h2}>Diagnostics</h2>
      <p style={styles.p}>
        {readOnly ? (
          <>
            Open <Link to="/diagnostics">Diagnostics</Link> for visits and branch setup. Ask a manager or lab admin to
            assign collectors.
          </>
        ) : (
          <>
            Manage tests, slots, and staff on the <Link to="/diagnostics">Diagnostics</Link> screen. Dispatch and lab
            desk stay on Home.
          </>
        )}
      </p>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    borderRadius: 'var(--radius-lg)',
    padding: '0.65rem 0.75rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
  },
  h2: { margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' },
  p: {
    margin: 0,
    fontSize: '0.78rem',
    lineHeight: 1.45,
    color: 'var(--text-muted)',
  },
};
