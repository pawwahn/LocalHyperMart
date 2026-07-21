import { useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner } from '@/shared/ui';
import { useVendorOrders } from '../hooks/useVendorOrders';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { DashboardStats } from '../components/DashboardStats';
import { SubOrderList } from '../components/SubOrderList';
import { ReasonDialog } from '../components/ReasonDialog';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'PLACED', label: 'New' },
  { value: 'READY_FOR_PICKUP', label: 'Ready' },
  { value: 'VENDOR_REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

type PromptState =
  | { kind: 'reject'; subOrderId: string }
  | { kind: 'cancelItem'; subOrderId: string; itemId: string; itemName: string }
  | null;

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
    moneyWaitingLabel,
    moneyWaitingHint,
    reload,
    markReady,
    reject,
    cancelItem,
  } = useVendorOrders();
  const {
    acceptingOrders,
    busy: shopBusy,
    error: shopError,
    setAcceptingOrders,
  } = useVendorShop();
  const [prompt, setPrompt] = useState<PromptState>(null);

  const dialogBusy = Boolean(
    prompt &&
      (prompt.kind === 'reject'
        ? actionId === prompt.subOrderId
        : actionId === `${prompt.subOrderId}:${prompt.itemId}`),
  );

  return (
    <PortalShell
      title="Seller home"
      onRefresh={() => void reload()}
      shopPause={{
        acceptingOrders,
        busy: shopBusy,
        onToggle: () => void setAcceptingOrders(!acceptingOrders),
      }}
    >
      {!acceptingOrders ? (
        <Banner tone="warning">
          Shop is paused — buyers cannot see your products. Resume when you are ready.
        </Banner>
      ) : null}
      {shopError ? <Banner tone="danger">{shopError}</Banner> : null}

      <DashboardStats
        dashboard={dashboard}
        loading={loading}
        moneyWaitingLabel={moneyWaitingLabel}
        moneyWaitingHint={moneyWaitingHint}
      />

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.sectionTitle}>Orders</h2>
          <div style={styles.filters}>
            {FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.label}
                  type="button"
                  style={active ? styles.filterActive : styles.filter}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <Banner tone="danger">{error}</Banner> : null}
        {notice ? <Banner tone="success">{notice}</Banner> : null}

        {loading && orders.length === 0 ? (
          <p style={styles.muted}>Loading orders…</p>
        ) : (
          <SubOrderList
            orders={orders}
            actionId={actionId}
            onReady={(id) => void markReady(id)}
            onReject={(id) => setPrompt({ kind: 'reject', subOrderId: id })}
            onCancelItem={(subOrderId, itemId, itemName) =>
              setPrompt({ kind: 'cancelItem', subOrderId, itemId, itemName })
            }
          />
        )}
      </section>

      <ReasonDialog
        open={prompt?.kind === 'cancelItem'}
        title={prompt?.kind === 'cancelItem' ? `Cancel “${prompt.itemName}”?` : 'Cancel item'}
        description="Buyer gets store credit for this line only. Other shops on the order are not affected."
        confirmLabel="Cancel item"
        defaultReason="Out of stock"
        danger
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setPrompt(null);
        }}
        onConfirm={(reason) => {
          if (prompt?.kind !== 'cancelItem') return;
          const { subOrderId, itemId } = prompt;
          void cancelItem(subOrderId, itemId, reason).then((ok) => {
            if (ok) setPrompt(null);
          });
        }}
      />

      <ReasonDialog
        open={prompt?.kind === 'reject'}
        title="Reject entire shop order?"
        description="This cancels the whole multi-vendor order for the buyer, including items from other shops."
        confirmLabel="Reject all"
        defaultReason="Out of stock today"
        danger
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setPrompt(null);
        }}
        onConfirm={(reason) => {
          if (prompt?.kind !== 'reject') return;
          const { subOrderId } = prompt;
          void reject(subOrderId, reason).then((ok) => {
            if (ok) setPrompt(null);
          });
        }}
      />
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
