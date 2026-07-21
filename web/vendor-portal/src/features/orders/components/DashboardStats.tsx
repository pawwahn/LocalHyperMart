import type { CSSProperties } from 'react';
import { Card } from '@/shared/ui';
import type { DashboardView } from '../api/ordersApi';

type Props = {
  dashboard: DashboardView | null;
  loading: boolean;
  moneyWaitingLabel: string;
  moneyWaitingHint: string;
};

export function DashboardStats({
  dashboard,
  loading,
  moneyWaitingLabel,
  moneyWaitingHint,
}: Props) {
  if (loading && !dashboard) {
    return <p style={styles.muted}>Loading dashboard…</p>;
  }
  if (!dashboard) return null;

  return (
    <section style={styles.wrap}>
      <div style={styles.primary}>
        <Stat
          label="Needs action"
          value={String(dashboard.pendingActionCount)}
          hint="New orders to Ready / Reject"
          emphasize={dashboard.pendingActionCount > 0}
          large
        />
        <Stat
          label="Today’s sales"
          value={dashboard.earningsTodayLabel}
          hint={`${dashboard.ordersToday} orders today`}
          large
        />
        <Stat label="Money waiting" value={moneyWaitingLabel} hint={moneyWaitingHint} large />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  emphasize,
  large,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
  large?: boolean;
}) {
  return (
    <div title={hint}>
      <Card
        elevated
        padding="sm"
        style={{ ...styles.card, ...(emphasize ? styles.cardHot : null) }}
      >
        <p style={styles.label}>{label}</p>
        <p style={large ? styles.valueLarge : styles.value}>{value}</p>
        <p style={styles.hint}>{hint}</p>
      </Card>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.65rem' },
  primary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.65rem',
  },
  card: { display: 'grid', gap: '0.15rem', padding: '0.75rem 0.85rem' },
  cardHot: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
  },
  label: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  value: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  valueLarge: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.55rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 },
  muted: { color: 'var(--text-muted)' },
};
