import type { CSSProperties } from 'react';

type Step = { id: string; label: string };

type Props = {
  steps: Step[];
  currentIndex: number;
  tone?: 'vendor' | 'buyer';
};

export function LegStepper({ steps, currentIndex, tone = 'vendor' }: Props) {
  const accent = tone === 'vendor' ? 'var(--success)' : 'var(--accent)';

  return (
    <ol style={styles.list}>
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} style={styles.item}>
            <span
              style={{
                ...styles.dot,
                borderColor: done || active ? accent : 'var(--border)',
                background: done ? accent : active ? `color-mix(in srgb, ${accent} 22%, transparent)` : 'transparent',
                color: done ? '#ffffff' : active ? accent : 'var(--text-muted)',
              }}
            >
              {done ? '✓' : index + 1}
            </span>
            <span style={{ ...styles.label, color: active ? 'var(--text)' : 'var(--text-muted)', fontWeight: active ? 700 : 500 }}>
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span
                style={{
                  ...styles.line,
                  background: done ? accent : 'var(--border)',
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

const styles: Record<string, CSSProperties> = {
  list: {
    listStyle: 'none',
    margin: '0.75rem 0 0',
    padding: 0,
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    position: 'relative',
    paddingRight: '0.5rem',
  },
  dot: {
    width: '1.35rem',
    height: '1.35rem',
    borderRadius: '999px',
    border: '2px solid',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  label: { fontSize: '0.88rem', fontWeight: 700 },
  line: {
    display: 'none',
  },
};
