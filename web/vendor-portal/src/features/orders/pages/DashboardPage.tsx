import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner } from '@/shared/ui';
import { useVendorOrders } from '../hooks/useVendorOrders';
import { DashboardStats } from '../components/DashboardStats';
import { SubOrderList } from '../components/SubOrderList';

const FILTERS = ['PLACED', 'READY_FOR_PICKUP', 'REJECTED', ''];

export function DashboardPage() {
  const {
    dashboard,
    orders,
    statusFilter,
    setStatusFilter,
    loading,
    actionId,
    error,
    notice,
    reload,
    markReady,
    reject,
  } = useVendorOrders();

  function handleReject(id: string) {
    const reason = window.prompt('Reason for rejection?', 'Out of stock today');
    if (!reason || !reason.trim()) return;
    void reject(id, reason.trim());
  }

  return (
    <PortalShell title="Orders dashboard" onRefresh={() => void reload()}>
      <DashboardStats dashboard={dashboard} loading={loading} />

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.sectionTitle}>Sub-orders</h2>
          <div style={styles.filters}>
            {FILTERS.map((f) => {
              const label = f || 'ALL';
              const active = statusFilter === f;
              return (
                <button
                  key={label}
                  type="button"
                  style={active ? styles.filterActive : styles.filter}
                  onClick={() => setStatusFilter(f)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {notice ? <Banner tone="success">{notice}</Banner> : null}

        {loading && orders.length === 0 ? (
          <p style={styles.muted}>Loading sub-orders…</p>
        ) : (
          <SubOrderList
            orders={orders}
            actionId={actionId}
            onReady={(id) => void markReady(id)}
            onReject={handleReject}
          />
        )}
      </section>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  section: { display: 'grid', gap: '1rem' },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sectionTitle: { margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800 },
  filters: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  filter: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.8rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  filterActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.8rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  muted: { color: 'var(--text-muted)' },
};
