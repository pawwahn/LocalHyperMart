import type { CSSProperties } from 'react';
import { Card } from '@/shared/ui';
import type { DashboardView } from '../api/ordersApi';
import { useIsNarrow } from '@/shared/hooks/useIsNarrow';

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
  const narrow = useIsNarrow();

  if (loading && !dashboard) {
    return <p style={styles.muted}>Loading dashboard…</p>;
  }
  if (!dashboard) return null;

  return (
    <section style={styles.wrap}>
      <div style={{ ...styles.primary, ...(narrow ? styles.primaryNarrow : null) }}>
        <Stat
          label="Needs action"
          value={String(dashboard.pendingActionCount)}
          hint="New orders — Mark ready / Reject my items"
          emphasize={dashboard.pendingActionCount > 0}
          large
          compact={narrow}
        />
        <Stat
          label="Today’s sales"
          value={dashboard.earningsTodayLabel}
          hint={`${dashboard.ordersToday} orders today`}
          large
          compact={narrow}
        />
        <Stat
          label="Money waiting"
          value={moneyWaitingLabel}
          hint={moneyWaitingHint}
          large
          compact={narrow}
        />
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
  compact,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
  large?: boolean;
  compact?: boolean;
}) {
  return (
    <div title={hint} style={styles.statCell}>
      <Card
        elevated
        padding="sm"
        style={{
          ...styles.card,
          ...(emphasize ? styles.cardHot : null),
          ...(compact ? styles.cardCompact : null),
        }}
      >
        <p style={styles.label}>{label}</p>
        <p style={large ? styles.valueLarge : styles.value}>{value}</p>
        <p style={styles.hint}>{hint}</p>
      </Card>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.65rem', minWidth: 0 },
  primary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.65rem',
  },
  primaryNarrow: {
    gridTemplateColumns: '1fr',
    gap: '0.45rem',
  },
  statCell: { minWidth: 0 },
  card: { display: 'grid', gap: '0.15rem', padding: '0.75rem 0.85rem' },
  cardCompact: { padding: '0.55rem 0.7rem' },
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
