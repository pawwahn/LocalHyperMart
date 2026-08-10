import type { CSSProperties } from 'react';

type Step = { id: string; label: string };

type Props = {
  steps: Step[];
  currentIndex: number;
  tone?: 'vendor' | 'buyer';
};

/** Horizontal progress like Swiggy Partner / Instamart delivery trips. */
export function LegStepper({ steps, currentIndex, tone = 'vendor' }: Props) {
  const accent = tone === 'vendor' ? 'var(--success)' : 'var(--accent)';

  return (
    <ol style={styles.list} aria-label="Trip progress">
      {steps.map((step, index) => {
        const fullyDone = currentIndex >= steps.length;
        const done = fullyDone || index < currentIndex;
        const active = !fullyDone && index === currentIndex;
        const connectorDone = fullyDone || index < currentIndex;
        return (
          <li key={step.id} style={styles.item}>
            <div style={styles.trackRow}>
              <span
                style={{
                  ...styles.dot,
                  borderColor: done || active ? accent : 'var(--border)',
                  background: done ? accent : active ? accent : 'var(--bg-elevated)',
                  color: done || active ? '#fff' : 'var(--text-muted)',
                  boxShadow: active ? `0 0 0 3px color-mix(in srgb, ${accent} 22%, transparent)` : undefined,
                }}
              >
                {done ? '✓' : index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  style={{
                    ...styles.line,
                    background: connectorDone ? accent : 'var(--border)',
                  }}
                />
              ) : null}
            </div>
            <span
              style={{
                ...styles.label,
                color: active || done ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: active ? 800 : 600,
              }}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const styles: Record<string, CSSProperties> = {
  list: {
    listStyle: 'none',
    margin: 0,
    padding: '0.15rem 0 0',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 0,
    width: '100%',
  },
  item: {
    display: 'grid',
    gap: '0.28rem',
    minWidth: 0,
  },
  trackRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  dot: {
    width: '1.4rem',
    height: '1.4rem',
    borderRadius: '999px',
    border: '2px solid',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.68rem',
    fontWeight: 800,
    flexShrink: 0,
    zIndex: 1,
  },
  line: {
    flex: 1,
    height: 2,
    marginLeft: 2,
    marginRight: 2,
    borderRadius: 2,
  },
  label: {
    fontSize: '0.72rem',
    lineHeight: 1.2,
    paddingRight: '0.25rem',
  },
};
