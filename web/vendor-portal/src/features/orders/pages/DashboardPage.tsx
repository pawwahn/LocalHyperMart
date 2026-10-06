import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { useAuth } from '@/shared/auth/AuthContext';
import { Banner, Button } from '@/shared/ui';
import { useVendorOrders } from '../hooks/useVendorOrders';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { DashboardStats } from '../components/DashboardStats';
import { SubOrderList } from '../components/SubOrderList';
import { ReasonDialog } from '../components/ReasonDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AssignVendorAgentDialog } from '@/features/delivery/components/AssignVendorAgentDialog';
import { vendorBagDisplayNumber, vendorBagLabelHint } from '../orderBagLabel';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'PLACED', label: 'New' },
  { value: 'READY_FOR_PICKUP', label: 'Ready' },
  { value: 'DELIVERY_BY_VENDOR_AGENT', label: 'My agent' },
  { value: 'VENDOR_REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

type PromptState =
  | { kind: 'markReady'; subOrderId: string; label: string }
  | { kind: 'deliveryByVendorAgent'; subOrderId: string; label: string }
  | { kind: 'assignVendorAgent'; subOrderId: string; label: string }
  | { kind: 'notifyAgent'; subOrderId: string; label: string }
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

export function DashboardPage({ active = true }: { active?: boolean }) {
  const { session } = useAuth();
  const {
    dashboard,
    orders,
    ordersNeedingAgent,
    myAgentPendingCount,
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
    deliveryByVendorAgent,
    assignVendorAgent,
    notifyVendorAgent,
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
  const location = useLocation();
  const { shop } = useVendorShop();
  const agentPendingCount = ordersNeedingAgent.length;

  useEffect(() => {
    const focus = (location.state as { focusAgentAssign?: boolean } | null)?.focusAgentAssign;
    if (focus) {
      setStatusFilter('DELIVERY_BY_VENDOR_AGENT');
    }
  }, [location.state, setStatusFilter]);
  const agentScope = useMemo(() => {
    if (!session?.accessToken || !session.vendorId || !shop?.shopId || !shop?.townId) return null;
    return {
      token: session.accessToken,
      vendorId: session.vendorId,
      shopId: shop.shopId,
      townId: shop.townId,
    };
  }, [session?.accessToken, session?.vendorId, shop?.shopId, shop?.townId]);

  usePortalChrome(
    {
      title: 'Seller home',
      onRefresh: () => void reload(),
      shopPause: {
        acceptingOrders,
        busy: shopBusy,
        onToggle: () => void setAcceptingOrders(!acceptingOrders),
      },
    },
    active,
  );

  const promptBagHint = useMemo(() => {
    if (!prompt || !('subOrderId' in prompt)) return null;
    const o = orders.find((x) => x.id === prompt.subOrderId);
    return o ? vendorBagLabelHint(o) : null;
  }, [orders, prompt]);

  const dialogBusy = Boolean(
    prompt &&
      (prompt.kind === 'markReady' ||
      prompt.kind === 'deliveryByVendorAgent' ||
      prompt.kind === 'assignVendorAgent' ||
      prompt.kind === 'reject'
        ? actionId === prompt.subOrderId
        : prompt.kind === 'cancelItem' || prompt.kind === 'restoreItem'
          ? actionId === `${prompt.subOrderId}:${prompt.itemId}` ||
            actionId === `${prompt.subOrderId}:${prompt.itemId}:restore`
          : false),
  );

  return (
    <div style={styles.page}>
      {!acceptingOrders ? (
        <Banner tone="warning">
          Shop is paused — buyers cannot see your products. Resume when you are ready.
        </Banner>
      ) : null}
      {shopError ? <Banner tone="danger">{shopError}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {agentPendingCount > 0 ? (
        <Banner tone="warning" style={styles.agentBanner}>
          <div style={styles.agentBannerText}>
            <strong>Assign your delivery agent</strong>
            <span style={styles.agentBannerSub}>
              {agentPendingCount === 1
                ? `Order ${vendorBagDisplayNumber(ordersNeedingAgent[0])} is on “My agent” delivery — hub will not pick it up until you assign someone.`
                : `${agentPendingCount} orders need a shop agent before delivery can start.`}
            </span>
          </div>
          <div style={styles.agentBannerActions}>
            {ordersNeedingAgent.slice(0, 2).map((o) => (
              <Button
                key={o.id}
                size="sm"
                onClick={() =>
                  setPrompt({
                    kind: 'assignVendorAgent',
                    subOrderId: o.id,
                    label: vendorBagDisplayNumber(o),
                  })
                }
              >
                Assign — {vendorBagDisplayNumber(o)}
              </Button>
            ))}
            {agentPendingCount > 2 ? (
              <Button size="sm" variant="secondary" onClick={() => setStatusFilter('DELIVERY_BY_VENDOR_AGENT')}>
                View all ({agentPendingCount})
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setStatusFilter('DELIVERY_BY_VENDOR_AGENT')}>
                Open My agent list
              </Button>
            )}
          </div>
        </Banner>
      ) : null}

      <DashboardStats
        dashboard={dashboard}
        loading={loading}
        moneyWaitingLabel={moneyWaitingLabel}
        moneyWaitingHint={moneyWaitingHint}
        agentAssignPendingCount={agentPendingCount}
      />

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.sectionTitle}>Orders</h2>
          <div style={styles.filters}>
            {FILTERS.map((f) => {
              const active = statusFilter === f.value;
              const badge =
                f.value === 'DELIVERY_BY_VENDOR_AGENT' ? myAgentPendingCount : 0;
              return (
                <button
                  key={f.label}
                  type="button"
                  style={
                    badge > 0 && !active
                      ? styles.filterAttention
                      : active
                        ? styles.filterActive
                        : styles.filter
                  }
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                  {badge > 0 ? ` (${badge})` : ''}
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
            onReady={(id, label) => setPrompt({ kind: 'markReady', subOrderId: id, label })}
            onDeliveryByVendorAgent={(id, label) =>
              setPrompt({ kind: 'deliveryByVendorAgent', subOrderId: id, label })
            }
            onAssignVendorAgent={(id, label) =>
              setPrompt({ kind: 'assignVendorAgent', subOrderId: id, label })
            }
            onNotifyAgent={(id, label) =>
              setPrompt({ kind: 'notifyAgent', subOrderId: id, label })
            }
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
        open={prompt?.kind === 'notifyAgent'}
        title="Notify your delivery agent?"
        description={
          prompt?.kind === 'notifyAgent'
            ? `Ring ${prompt.label} on the agent's KoyaKart Delivery app. Sound and vibration repeat until they tap Got it.`
            : 'Notify the assigned agent on their delivery app.'
        }
        confirmLabel="Yes — notify agent"
        cancelLabel="Cancel"
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setPrompt(null);
        }}
        onConfirm={() => {
          if (prompt?.kind !== 'notifyAgent') return;
          const id = prompt.subOrderId;
          void notifyVendorAgent(id).then(() => setPrompt(null));
        }}
      />
      <ConfirmDialog
        open={prompt?.kind === 'deliveryByVendorAgent'}
        title="Delivery by your agent?"
        description={
          prompt?.kind === 'deliveryByVendorAgent'
            ? `Order ${prompt.label}. Hub will not handle delivery. You must assign your shop agent afterward.${promptBagHint ? `\n\n${promptBagHint}` : ''}`
            : 'Hub will not handle delivery for this order.'
        }
        confirmLabel="Yes — my agent delivers"
        cancelLabel="Cancel"
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setPrompt(null);
        }}
        onConfirm={() => {
          if (prompt?.kind !== 'deliveryByVendorAgent') return;
          const { subOrderId: id, label } = prompt;
          void deliveryByVendorAgent(id).then(() => {
            setStatusFilter('DELIVERY_BY_VENDOR_AGENT');
            setPrompt({ kind: 'assignVendorAgent', subOrderId: id, label });
          });
        }}
      />
      <ConfirmDialog
        open={prompt?.kind === 'markReady'}
        title="Bag packed and ready?"
        description={
          prompt?.kind === 'markReady'
            ? `Order ${prompt.label}. Tap YES only if the bag is packed and waiting for the delivery agent.`
            : 'Tap YES only if the bag is packed and waiting for the delivery agent.'
        }
        confirmLabel="YES — mark ready"
        cancelLabel="NO — still packing"
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setPrompt(null);
        }}
        onConfirm={() => {
          if (prompt?.kind !== 'markReady') return;
          const id = prompt.subOrderId;
          void markReady(id).then(() => setPrompt(null));
        }}
      />
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
        title="Reject your items?"
        description="Only your shop’s bag is cancelled. Other shops on this order keep going. The buyer gets store credit for your items."
        confirmLabel="Yes, reject my items"
        cancelLabel="Keep packing"
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
      <AssignVendorAgentDialog
        open={prompt?.kind === 'assignVendorAgent'}
        subOrderLabel={
          prompt?.kind === 'assignVendorAgent' ? prompt.label : ''
        }
        scope={agentScope}
        busy={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setPrompt(null);
        }}
        onConfirm={(agentId) => {
          if (prompt?.kind !== 'assignVendorAgent') return;
          void assignVendorAgent(prompt.subOrderId, agentId).then(() => setPrompt(null));
        }}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: 'grid', gap: '0.65rem', alignContent: 'start', minWidth: 0 },
  section: { display: 'grid', gap: '0.5rem' },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sectionTitle: { margin: 0, fontSize: '1.05rem', fontFamily: 'var(--font-display)', fontWeight: 800 },
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
  agentBanner: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentBannerText: { display: 'grid', gap: '0.25rem', flex: '1 1 12rem', minWidth: 0 },
  agentBannerSub: { fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.35 },
  agentBannerActions: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' },
  filterAttention: {
    border: '1px solid #d97706',
    background: 'var(--warning-soft)',
    color: '#92400e',
    borderRadius: 'var(--radius-full)',
    padding: '0.4rem 0.8rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 800,
  },
};
