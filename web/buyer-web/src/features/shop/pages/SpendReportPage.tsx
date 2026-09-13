import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { useShop } from '../hooks/useShop';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import { fetchBuyerSpendReport, type BuyerSpendReport } from '../api/spendReportApi';

function isoIst(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function money(n?: number | null): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

export function SpendReportPage() {
  const { session } = useAuth();
  const { townId } = useTown();
  const { cart } = useShop();
  const to = isoIst();
  const fromDefault = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return isoIst(d);
  })();
  const [from, setFrom] = useState(fromDefault);
  const [report, setReport] = useState<BuyerSpendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setReport(
        await fetchBuyerSpendReport(session.accessToken, {
          townId: townId || undefined,
          from,
          to,
        }),
      );
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Could not load spend');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, townId, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <PortalShell
      title="My spend"
      subtitle="Orders and money in this town"
      showDeliveryBanner={false}
      cartCount={cart?.itemCount ?? 0}
      onRefresh={() => void reload()}
    >
      <div style={styles.filters}>
        <label style={styles.field}>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={styles.input} />
        </label>
        <span style={styles.to}>to {to}</span>
      </div>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading && !report ? <LoadingBlock label="Loading spend…" /> : null}
      {report && report.ordersPlaced === 0 ? (
        <EmptyState icon="🧾" title="No orders yet" description="Place an order to see your spend report." />
      ) : null}
      {report && report.ordersPlaced > 0 ? (
        <>
          <div style={styles.kpis}>
            <Kpi label="Spent" value={money(report.spent)} />
            <Kpi label="Delivered" value={money(report.deliveredSpend)} />
            <Kpi label="Orders" value={String(report.ordersPlaced)} />
            <Kpi label="AOV" value={money(report.averageOrderValue)} />
            <Kpi label="COD" value={money(report.codSpend)} />
            <Kpi label="Online" value={money(report.onlineSpend)} />
          </div>
          <div style={styles.months}>
            {report.months.map((row) => (
              <div key={row.month} style={styles.monthRow}>
                <strong>{row.month}</strong>
                <span>
                  {row.orders} orders · {money(row.spent)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </PortalShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiLabel}>{label}</span>
      <strong style={styles.kpiValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  filters: { display: 'flex', alignItems: 'end', gap: '0.5rem' },
  field: { display: 'grid', gap: '0.15rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  input: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 8,
    padding: '0.35rem 0.5rem',
    minHeight: 36,
  },
  to: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', paddingBottom: '0.35rem' },
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.4rem',
  },
  kpi: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.4rem 0.5rem',
    display: 'grid',
    gap: '0.05rem',
  },
  kpiLabel: { fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' },
  kpiValue: { fontFamily: 'var(--font-display)', fontSize: '0.98rem' },
  months: { display: 'grid', gap: '0.3rem' },
  monthRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.4rem 0.55rem',
    fontSize: '0.82rem',
  },
};
