import type { CSSProperties } from 'react';
import { Card } from '@/shared/ui';
import type { DashboardView } from '../api/ordersApi';

type Props = {
  dashboard: DashboardView | null;
  loading: boolean;
};

export function DashboardStats({ dashboard, loading }: Props) {
  if (loading && !dashboard) {
    return <p style={styles.muted}>Loading dashboard…</p>;
  }
  if (!dashboard) return null;

  return (
    <section style={styles.grid}>
      <Stat label="Orders today" value={String(dashboard.ordersToday)} hint="Live today" />
      <Stat label="Orders this week" value={String(dashboard.ordersWeek)} hint="Rolling 7 days" />
      <Stat label="Gross earnings" value={dashboard.earningsLabel} hint="Pilot town" />
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card elevated style={styles.card}>
      <p style={styles.label}>{label}</p>
      <p style={styles.value}>{value}</p>
      <p style={styles.hint}>{hint}</p>
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.9rem',
  },
  card: { display: 'grid', gap: '0.25rem' },
  label: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  value: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.75rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  hint: { margin: 0, color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 700 },
  muted: { color: 'var(--text-muted)' },
};
