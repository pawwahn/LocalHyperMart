import { useMemo, useState, type CSSProperties } from 'react';

export type TimelineStep = {
  code: string;
  label: string;
  state: string;
  at?: string | null;
  note?: string | null;
};

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function isTerminalStatus(status?: string | null): boolean {
  const s = (status || '').toUpperCase();
  return s.includes('DELIVER') || s.includes('CANCEL') || s.includes('FAIL');
}

function summaryFromSteps(steps: TimelineStep[], fallbackStatus?: string | null): string {
  const current = steps.find((s) => (s.state || '').toUpperCase() === 'CURRENT');
  if (current) {
    const when = formatWhen(current.at);
    return when ? `${current.label} · ${when}` : current.label;
  }
  const done = [...steps].reverse().find((s) => (s.state || '').toUpperCase() === 'DONE');
  if (done) {
    const when = formatWhen(done.at);
    return when ? `${done.label} · ${when}` : done.label;
  }
  return fallbackStatus?.trim() || 'Order progress';
}

type Props = {
  steps: TimelineStep[];
  /** Raw order status — used to decide default collapsed vs expanded. */
  orderStatus?: string | null;
  displayStatus?: string | null;
};

export function OrderStatusTimeline({ steps, orderStatus, displayStatus }: Props) {
  const terminal = isTerminalStatus(orderStatus) || isTerminalStatus(displayStatus);
  const [expanded, setExpanded] = useState(!terminal);

  const summary = useMemo(
    () => summaryFromSteps(steps, displayStatus || orderStatus),
    [steps, displayStatus, orderStatus],
  );

  if (!steps.length) return null;

  return (
    <section style={styles.section} aria-label="Order progress">
      <button
        type="button"
        style={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={styles.toggleText}>
          <span style={styles.h2}>Order progress</span>
          {!expanded ? <span style={styles.summary}>{summary}</span> : null}
        </div>
        <span style={styles.chevron} aria-hidden>
          {expanded ? '▴' : '▾'}
        </span>
      </button>

      {expanded ? (
        <ol style={styles.list}>
          {steps.map((step, index) => {
            const state = (step.state || 'UPCOMING').toUpperCase();
            const done = state === 'DONE';
            const current = state === 'CURRENT';
            const skipped = state === 'SKIPPED';
            const isLast = index === steps.length - 1;
            return (
              <li key={step.code} style={styles.item}>
                <div style={styles.rail}>
                  <span
                    style={{
                      ...styles.dot,
                      ...(done ? styles.dotDone : null),
                      ...(current ? styles.dotCurrent : null),
                      ...(skipped ? styles.dotSkipped : null),
                    }}
                    aria-hidden
                  />
                  {!isLast ? (
                    <span
                      style={{
                        ...styles.line,
                        ...(done ? styles.lineDone : null),
                      }}
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div style={styles.body}>
                  <p
                    style={{
                      ...styles.label,
                      ...(current ? styles.labelCurrent : null),
                      ...(skipped ? styles.labelMuted : null),
                      ...(!done && !current ? styles.labelMuted : null),
                    }}
                  >
                    {step.label}
                  </p>
                  {step.at ? <p style={styles.meta}>{formatWhen(step.at)}</p> : null}
                  {step.note ? <p style={styles.note}>{step.note}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  section: { display: 'grid', gap: '0.45rem' },
  toggle: {
    appearance: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    padding: '0.7rem 0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
  },
  toggleText: {
    display: 'grid',
    gap: '0.15rem',
    minWidth: 0,
    flex: 1,
  },
  h2: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    color: 'var(--text)',
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
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    flexShrink: 0,
    lineHeight: 1,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: '0.65rem 0.85rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: 0,
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '1.1rem 1fr',
    gap: '0.7rem',
    minHeight: '2.4rem',
  },
  rail: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '0.2rem',
  },
  dot: {
    width: '0.72rem',
    height: '0.72rem',
    borderRadius: '50%',
    border: '2px solid var(--border)',
    background: 'var(--bg)',
    flexShrink: 0,
  },
  dotDone: {
    borderColor: 'var(--accent)',
    background: 'var(--accent)',
  },
  dotCurrent: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-soft)',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  dotSkipped: {
    borderColor: 'var(--border)',
    background: 'var(--bg-muted)',
  },
  line: {
    width: '2px',
    flex: 1,
    minHeight: '1.1rem',
    marginTop: '0.2rem',
    background: 'var(--border)',
  },
  lineDone: {
    background: 'var(--accent)',
  },
  body: {
    paddingBottom: '0.65rem',
    minWidth: 0,
  },
  label: {
    margin: 0,
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  labelCurrent: {
    color: 'var(--accent-hover)',
  },
  labelMuted: {
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  meta: {
    margin: '0.1rem 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  note: {
    margin: '0.15rem 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    lineHeight: 1.35,
  },
};
