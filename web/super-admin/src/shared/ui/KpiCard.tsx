import type { CSSProperties } from 'react';

type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  /** Native tooltip (hover / focus) with fuller explanation. */
  tip?: string;
};

export function KpiCard({ label, value, hint, tip }: KpiCardProps) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiLabelRow}>
        <span style={styles.kpiLabel}>{label}</span>
        {tip ? (
          <button type="button" style={styles.kpiTipBtn} title={tip} aria-label={`About ${label}`}>
            ?
          </button>
        ) : null}
      </span>
      <strong style={styles.kpiValue}>{value}</strong>
      <span style={styles.kpiHint}>{hint}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  kpi: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.4rem 0.5rem',
    display: 'grid',
    gap: '0.05rem',
  },
  kpiLabelRow: { display: 'flex', alignItems: 'center', gap: '0.2rem' },
  kpiLabel: { fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  kpiTipBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    borderRadius: 999,
    width: 14,
    height: 14,
    fontSize: '0.6rem',
    fontWeight: 800,
    lineHeight: 1,
    padding: 0,
    cursor: 'help',
    flexShrink: 0,
  },
  kpiValue: { fontFamily: 'var(--font-display)', fontSize: '1.05rem', letterSpacing: '-0.03em' },
  kpiHint: { fontSize: '0.65rem', color: 'var(--text-muted)' },
};
