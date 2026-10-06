import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { Banner, Button, Card } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { fetchSalesReport, type ItemPerformance } from '@/features/reports/api/reportsApi';
import { ItemRankTable } from '@/features/reports/components/ItemRankTable';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { rangeForReportPreset, type ReportDatePreset } from '@hlm-dates/istReportPresets';

export function SellersPage() {
  const { session } = useAuth();
  const initial = rangeForReportPreset('week');
  const [preset, setPreset] = useState<ReportDatePreset>('week');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [productTab, setProductTab] = useState<'top' | 'least'>('top');
  const [topItems, setTopItems] = useState<ItemPerformance[]>([]);
  const [leastItems, setLeastItems] = useState<ItemPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const report = await fetchSalesReport(session.accessToken, session.vendorId, {
        from,
        to,
        includeItems: false,
      });
      setTopItems(report.topSellingItems ?? []);
      setLeastItems(report.leastSellingItems ?? []);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load sellers');
      setTopItems([]);
      setLeastItems([]);
    } finally {
      setLoading(false);
    }
  }, [session, from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  usePortalChrome({ title: 'Sellers', onRefresh: () => void reload() });

  return (
    <div style={styles.pageStack}>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card elevated padding="sm" style={styles.filterCard}>
        <DateRangePresetBar
          preset={preset}
          from={from}
          to={to}
          onPresetChange={setPreset}
          onFromChange={setFrom}
          onToChange={setTo}
          ariaLabel="Seller report period"
        />

        <div style={styles.actions}>
          <Button size="sm" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Loading…' : 'Run'}
          </Button>
        </div>
      </Card>

      <Card>
        <div style={styles.productTabs} role="tablist" aria-label="Product performance">
          <button
            type="button"
            role="tab"
            aria-selected={productTab === 'top'}
            style={productTab === 'top' ? styles.productTabActive : styles.productTab}
            onClick={() => setProductTab('top')}
          >
            Top sellers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={productTab === 'least'}
            style={productTab === 'least' ? styles.productTabActive : styles.productTab}
            onClick={() => setProductTab('least')}
          >
            Least sold
          </button>
        </div>
        {loading && topItems.length === 0 && leastItems.length === 0 ? (
          <p style={styles.muted}>Loading…</p>
        ) : productTab === 'top' ? (
          <ItemRankTable empty="No sold items in this range." rows={topItems} />
        ) : (
          <ItemRankTable empty="No sold items in this range." rows={leastItems} />
        )}
      </Card>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageStack: { display: 'grid', gap: '0.75rem' },
  filterCard: { display: 'grid', gap: '0.65rem', padding: '0.85rem' },
  presets: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  preset: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  presetActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  dateRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.55rem',
  },
  label: { display: 'grid', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 },
  input: {
    padding: '0.45rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  rangeHint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
  actions: { display: 'flex', gap: '0.45rem', flexWrap: 'wrap' },
  productTabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.3rem',
    padding: '0.25rem',
    marginBottom: '0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  },
  productTab: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-md)',
    padding: '0.45rem 0.65rem',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  productTabActive: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '0.45rem 0.65rem',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 800,
    fontFamily: 'inherit',
    boxShadow: 'var(--shadow-card)',
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' },
};
