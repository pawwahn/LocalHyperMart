import { useState, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner } from '@/shared/ui';
import { useVendorOrders } from '../hooks/useVendorOrders';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { DashboardStats } from '../components/DashboardStats';
import { SubOrderList } from '../components/SubOrderList';
import { ReasonDialog } from '../components/ReasonDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'PLACED', label: 'New' },
  { value: 'READY_FOR_PICKUP', label: 'Ready' },
  { value: 'VENDOR_REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

type PromptState =
  | { kind: 'reject'; subOrderId: string }
  | { kind: 'cancelItemAsk'; subOrderId: string; itemId: string; itemName: string }
  | { kind: 'cancelItem'; subOrderId: string; itemId: string; itemName: string }
  | {
      kind: 'restoreItem';
      subOrderId: string;
      itemId: string;
      itemName: string;
      creditLabel: string;
    }
  | { kind: 'actionResult'; ok: boolean; title: string; message: string }
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
    restoreItem,
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
        : prompt.kind === 'cancelItem' || prompt.kind === 'restoreItem'
          ? actionId === `${prompt.subOrderId}:${prompt.itemId}` ||
            actionId === `${prompt.subOrderId}:${prompt.itemId}:restore`
          : false),
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
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

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

        {loading && orders.length === 0 ? (
          <p style={styles.muted}>Loading orders…</p>
        ) : (
          <SubOrderList
            orders={orders}
            actionId={actionId}
            onReady={(id) => void markReady(id)}
            onReject={(id) => setPrompt({ kind: 'reject', subOrderId: id })}
            onCancelItem={(subOrderId, itemId, itemName) =>
              setPrompt({ kind: 'cancelItemAsk', subOrderId, itemId, itemName })
            }
            onRestoreItem={(subOrderId, itemId, itemName, creditLabel) =>
              setPrompt({ kind: 'restoreItem', subOrderId, itemId, itemName, creditLabel })
            }
          />
        )}
      </section>

      <ConfirmDialog
        open={prompt?.kind === 'cancelItemAsk'}
        title={
          prompt?.kind === 'cancelItemAsk'
            ? `Cancel “${prompt.itemName}” from this order?`
            : 'Cancel item?'
        }
        description="This cannot be undone here. The buyer gets store credit for this item only. Other shops on the order are not affected. You can Restore later only if the buyer has not used that credit and the agent has not picked up yet."
        confirmLabel="Continue"
        cancelLabel="Keep item"
        danger
        onClose={() => setPrompt(null)}
        onConfirm={() => {
          if (prompt?.kind !== 'cancelItemAsk') return;
          setPrompt({
            kind: 'cancelItem',
            subOrderId: prompt.subOrderId,
            itemId: prompt.itemId,
            itemName: prompt.itemName,
          });
        }}
      />

      <ReasonDialog
        open={prompt?.kind === 'cancelItem'}
        title={prompt?.kind === 'cancelItem' ? `Confirm cancel: “${prompt.itemName}”` : 'Cancel item'}
        description="Enter a reason. Buyer gets store credit for this line only."
        confirmLabel="Yes, cancel item"
        cancelLabel="Keep item"
        defaultReason="Out of stock"
        danger
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setPrompt(null);
        }}
        onConfirm={(reason) => {
          if (prompt?.kind !== 'cancelItem') return;
          const { subOrderId, itemId, itemName } = prompt;
          void cancelItem(subOrderId, itemId, reason, itemName).then((result) => {
            setPrompt({
              kind: 'actionResult',
              ok: result.ok,
              title: result.ok ? 'Item cancelled' : 'Couldn’t cancel',
              message: result.message,
            });
          });
        }}
      />

      <ConfirmDialog
        open={prompt?.kind === 'restoreItem'}
        title={
          prompt?.kind === 'restoreItem'
            ? `Restore “${prompt.itemName}” to this order?`
            : 'Restore item?'
        }
        description={
          prompt?.kind === 'restoreItem'
            ? `We will check the buyer’s wallet. Restore succeeds only if at least ${prompt.creditLabel} store credit is still available; that amount will be reversed.`
            : 'Wallet credit must still be available.'
        }
        confirmLabel="Yes, restore"
        cancelLabel="Don’t restore"
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setPrompt(null);
        }}
        onConfirm={() => {
          if (prompt?.kind !== 'restoreItem') return;
          const { subOrderId, itemId, itemName } = prompt;
          void restoreItem(subOrderId, itemId, itemName).then((result) => {
            setPrompt({
              kind: 'actionResult',
              ok: result.ok,
              title: result.ok ? 'Item restored' : 'Couldn’t restore',
              message: result.message,
            });
          });
        }}
      />

      <ConfirmDialog
        open={prompt?.kind === 'actionResult'}
        title={prompt?.kind === 'actionResult' ? prompt.title : 'Result'}
        description={prompt?.kind === 'actionResult' ? prompt.message : ''}
        confirmLabel="OK"
        alertOnly
        danger={prompt?.kind === 'actionResult' ? !prompt.ok : false}
        onClose={() => setPrompt(null)}
        onConfirm={() => setPrompt(null)}
      />

      <ReasonDialog
        open={prompt?.kind === 'reject'}
        title="Reject entire shop order?"
        description="This cancels the whole multi-vendor order for the buyer, including items from other shops."
        confirmLabel="Yes, reject all"
        cancelLabel="Keep order"
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
