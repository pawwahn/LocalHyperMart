import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { ActionTimeline } from '@/shared/components/ActionTimeline';
import { PaginationBar } from '@/shared/components/PaginationBar';
import { WorklistToolbar } from '@/shared/components/WorklistToolbar';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { formatPortalTime } from '@/shared/time/formatPortalTime';
import { HubShell } from '../layout/HubShell';
import { useHubWorkspace, type HubOrderTab } from '../hooks/useHubWorkspace';
import type { OrderRowView } from '../api/hubApi';

type PickupUiState = 'awaiting_vendor' | 'ready' | 'agent_assigned' | 'agent_collecting' | 'at_hub';

function vendorLegState(
  status: string,
  assignment?: { status: string },
): PickupUiState {
  if (status === 'DELIVERED') return 'at_hub';
  if (status === 'PLACED') return 'awaiting_vendor';
  if (assignment?.status === 'COMPLETED') return 'at_hub';
  if (assignment?.status === 'IN_PROGRESS') return 'agent_collecting';
  if (assignment?.status === 'ASSIGNED') return 'agent_assigned';
  if (status === 'READY_FOR_PICKUP') return 'ready';
  return 'at_hub';
}

function subOrderCardStyle(state: PickupUiState): CSSProperties {
  if (state === 'ready') return { ...styles.card, ...styles.cardReady };
  if (state === 'awaiting_vendor') return { ...styles.card, ...styles.cardWaiting };
  if (state === 'at_hub') return { ...styles.card, ...styles.cardAtHub };
  return { ...styles.card, ...styles.cardInProgress };
}

function orderWhatToDo(order: OrderRowView): { label: string; tone: 'wait' | 'go' | 'partial' | 'done' } {
  if (order.status === 'DELIVERED') {
    return { label: 'Delivered to customer ✓', tone: 'done' };
  }
  if (order.status === 'CANCELLED') {
    return { label: 'Cancelled', tone: 'wait' };
  }
  if (order.pickupReadiness === 'none') {
    return { label: 'Shop is still packing — wait', tone: 'wait' };
  }
  if (order.pickupReadiness === 'partial') {
    return {
      label: `${order.readySubOrderCount} shop ready — send boy (other shop still packing)`,
      tone: 'partial',
    };
  }
  return { label: 'All shops ready — bring to hub / send home', tone: 'go' };
}

function orderRowStyle(order: OrderRowView, selected: boolean): CSSProperties {
  const base = selected ? styles.orderActive : styles.order;
  if (order.status === 'DELIVERED') {
    return { ...base, borderColor: 'var(--success)', background: 'rgba(129, 199, 132, 0.1)' };
  }
  if (order.status === 'CANCELLED') {
    return { ...base, borderColor: 'var(--border)', background: 'var(--bg-muted)' };
  }
  if (order.pickupReadiness === 'all') {
    return { ...base, borderColor: 'var(--success)', background: 'rgba(129, 199, 132, 0.1)' };
  }
  if (order.pickupReadiness === 'partial') {
    return { ...base, borderColor: 'var(--warning)', background: 'rgba(255, 183, 77, 0.1)' };
  }
  return { ...base, borderColor: 'var(--danger)', background: 'rgba(229, 115, 115, 0.08)' };
}

function vendorLegStatusLabel(state: PickupUiState): string {
  switch (state) {
    case 'awaiting_vendor':
      return 'Shop packing';
    case 'ready':
      return 'Ready at shop — send boy';
    case 'agent_assigned':
      return 'Boy going to shop';
    case 'agent_collecting':
      return 'Bag with boy — waiting at hub';
    case 'at_hub':
      return 'Bag arrived at hub ✓';
  }
}

type VendorLegAction =
  | { kind: 'none' }
  | { kind: 'assign'; label: string }
  | { kind: 'confirm'; label: string };

function vendorLegAction(state: PickupUiState): VendorLegAction {
  switch (state) {
    case 'ready':
      return { kind: 'assign', label: 'Send boy to shop' };
    case 'agent_collecting':
      return { kind: 'confirm', label: 'Bag reached hub — tap here' };
    default:
      return { kind: 'none' };
  }
}

function vendorLegHint(state: PickupUiState): string {
  switch (state) {
    case 'ready':
      return 'Shop packed this bag. Send a delivery boy to pick it up.';
    case 'awaiting_vendor':
      return 'Wait. Shop has not packed yet.';
    case 'agent_assigned':
      return 'Boy is going to the shop. Wait.';
    case 'agent_collecting':
      return 'Boy has the bag. When he reaches the hub, tap the green button.';
    case 'at_hub':
      return 'This bag is already at your hub.';
  }
}

function legLabel(legType: string): string {
  return legType === 'PICKUP' ? 'Shop → Hub' : 'Hub → Home';
}

function assignmentLegStyle(legType: string): CSSProperties {
  return legType === 'PICKUP' ? styles.legVendor : styles.legBuyer;
}

function assignmentStatusPlain(status: string): string {
  if (status === 'ASSIGNED') return 'Boy sent';
  if (status === 'IN_PROGRESS') return 'Boy on the way';
  if (status === 'COMPLETED') return 'Done';
  return status;
}

function allVendorPickupsComplete(
  subOrders: { subOrderNumber: string }[],
  assignments: Array<{ legType: string; status: string; subOrderNumber?: string | null }>,
): boolean {
  if (subOrders.length === 0) return false;
  return subOrders.every((sub) =>
    assignments.some(
      (a) => a.legType === 'PICKUP' && a.status === 'COMPLETED' && a.subOrderNumber === sub.subOrderNumber,
    ),
  );
}

function lastMileAssignment(
  assignments: Array<{
    legType: string;
    status: string;
    assignmentNumber?: string;
    assignedAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    events?: Array<{ eventType: string; createdAt: string }>;
  }>,
) {
  return assignments.find((a) => a.legType === 'LAST_MILE');
}

export function HubDashboardPage() {
  const {
    dashboard,
    orders,
    orderTab,
    search,
    page,
    pageSize,
    totalPages,
    totalElements,
    tabCounts,
    selectedOrderId,
    detail,
    subOrders,
    showHistory,
    loading,
    busy,
    error,
    notice,
    reload,
    changeTab,
    setSearch,
    setPage,
    setShowHistory,
    openOrder,
    clearOrderSelection,
    doAssignPickup,
    doMarkAtHub,
    doAssignLastMile,
  } = useHubWorkspace();

  const isMobile = useIsMobile();
  const detailRef = useRef<HTMLDivElement>(null);
  const showMobileDetail = isMobile && Boolean(detail);

  useEffect(() => {
    if (showMobileDetail && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showMobileDetail, selectedOrderId]);

  const hubTabs = [
    {
      id: 'action' as HubOrderTab,
      label: 'Your work',
      count: tabCounts.action,
      help: 'At least 1 shop is ready',
    },
    {
      id: 'vendor-wait' as HubOrderTab,
      label: 'Shop packing',
      count: tabCounts.vendorWait,
      help: 'No shop ready yet — wait',
    },
    {
      id: 'all' as HubOrderTab,
      label: 'All open',
      count: tabCounts.all,
      help: 'Not delivered yet',
    },
  ];

  return (
    <HubShell
      title="Hub desk"
      subtitle={dashboard ? dashboard.hubName : undefined}
      onRefresh={() => void reload()}
    >
      {loading && !dashboard ? <p style={styles.muted}>Loading…</p> : null}

      <section style={styles.howto} aria-label="How delivery works">
        <p style={styles.howtoTitle}>How it works (3 steps)</p>
        <div style={isMobile ? styles.howtoStepsMobile : styles.howtoSteps}>
          <div style={styles.howtoStep}>
            <span style={styles.howtoNum}>1</span>
            <div>
              <strong>Shop packs</strong>
              <p style={styles.howtoText}>Shop packs the bag</p>
            </div>
          </div>
          <div style={styles.howtoStep}>
            <span style={styles.howtoNum}>2</span>
            <div>
              <strong>Bring to hub</strong>
              <p style={styles.howtoText}>Boy brings bag to hub</p>
            </div>
          </div>
          <div style={styles.howtoStep}>
            <span style={styles.howtoNum}>3</span>
            <div>
              <strong>Send home</strong>
              <p style={styles.howtoText}>Boy takes order to customer</p>
            </div>
          </div>
        </div>
      </section>

      {dashboard ? (
        <section style={isMobile ? styles.statsMobile : styles.stats} aria-label="Today numbers">
          <Stat
            icon="🛍️"
            value={String(dashboard.readyForPickup)}
            title="Bags ready at shop"
            help="Shop packed — send boy to shop"
            tone="go"
          />
          <Stat
            icon="🏠"
            value={String(dashboard.awaitingDelivery)}
            title="Orders still open"
            help="Not finished — customer waiting"
            tone="info"
          />
          <Stat
            icon="🛵"
            value={String(dashboard.activeAgents)}
            title="Boys available"
            help="Delivery boys ready for work"
            tone="ok"
          />
          <Stat
            icon="📦"
            value={String(dashboard.activeAssignments)}
            title="Boys on a trip"
            help="Already going to shop or home"
            tone="warn"
          />
        </section>
      ) : null}

      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.notice}>{notice}</p> : null}

      <section style={isMobile ? styles.splitMobile : styles.split}>
        {!showMobileDetail ? (
          <div>
            <h2 style={styles.h2}>Order list</h2>
            <WorklistToolbar
              tabs={hubTabs}
              activeTab={orderTab}
              onTabChange={(id) => changeTab(id as HubOrderTab)}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Type order number here…"
              hint={
                orderTab === 'action'
                  ? 'These orders have at least one shop ready. You can send a boy for the ready shop. Other shops in the same order may still be packing.'
                  : orderTab === 'vendor-wait'
                    ? 'No shop has packed yet on these orders. Wait — do not send a boy yet.'
                    : 'All open orders in this town (not delivered yet). Your work + Shop packing cover waiting/action; this tab also includes orders already at hub or going home.'
              }
            />
            <div style={styles.list}>
              {loading && orders.length === 0 ? (
                <p style={styles.muted}>Loading orders…</p>
              ) : orders.length === 0 ? (
                <p style={styles.emptyBox}>
                  {search.trim()
                    ? 'No order found. Check the number and try again.'
                    : orderTab === 'action'
                      ? 'Good news — nothing needs you right now.'
                      : orderTab === 'vendor-wait'
                        ? 'No orders waiting on shops right now.'
                        : 'No open orders yet.'}
                </p>
              ) : (
                orders.map((o) => {
                  const what = orderWhatToDo(o);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      style={orderRowStyle(o, selectedOrderId === o.id)}
                      onClick={() => void openOrder(o.id)}
                    >
                      <strong style={styles.orderNo}>{o.orderNumber}</strong>
                      <span style={styles.meta}>
                        {o.totalLabel} · {o.subOrderCount} shop bag
                        {o.subOrderCount === 1 ? '' : 's'}
                      </span>
                      <span
                      style={
                        what.tone === 'done' || what.tone === 'go'
                          ? styles.badgeReady
                          : what.tone === 'partial'
                            ? styles.badgePartial
                            : styles.badgeWaiting
                      }
                    >
                      {what.label}
                    </span>
                    <span style={styles.bagCount}>
                      {o.status === 'DELIVERED'
                        ? 'Finished — delivered to home'
                        : o.status === 'CANCELLED'
                          ? 'Order cancelled'
                          : `Packed: ${o.readySubOrderCount} of ${o.subOrderCount}`}
                    </span>
                    </button>
                  );
                })
              )}
            </div>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        ) : null}

        {detail || !isMobile ? (
        <div ref={detailRef}>
          <div style={styles.detailHeader}>
            <h2 style={{ ...styles.h2, margin: 0 }}>What to do for this order</h2>
            {showMobileDetail ? (
              <button type="button" style={styles.backBtn} onClick={clearOrderSelection}>
                ← All orders
              </button>
            ) : null}
          </div>
          {!detail ? (
            <p style={styles.emptyBox}>← Tap one order on the left to see buttons.</p>
          ) : (
            <div style={styles.detail}>
              <p style={styles.detailTitle}>{detail.orderNumber}</p>
              <p style={styles.detailMoney}>₹{Number(detail.totalAmount).toFixed(2)} · Cash on delivery</p>
              {detail.placedAt ? (
                <p style={styles.timeLine}>Order placed · {formatPortalTime(detail.placedAt)}</p>
              ) : null}
              {detail.deliveredAt ? (
                <p style={styles.timeLine}>Delivered · {formatPortalTime(detail.deliveredAt)}</p>
              ) : null}
              {detail.status === 'DELIVERED' ? (
                <p style={styles.deliveredBanner}>Delivered to customer ✓ — no more action needed</p>
              ) : null}
              {detail.status === 'CANCELLED' ? (
                <p style={styles.cancelledBanner}>This order was cancelled</p>
              ) : null}

              <div style={styles.legSection}>
                <h3 style={styles.h3}>
                  <span style={styles.legVendor}>Step 1 — Bring bags from shop</span>
                </h3>
                <p style={styles.legHintBlock}>Each shop bag needs its own trip to the hub.</p>
                {subOrders.map((s) => {
                  const vendorPickup = (detail.assignments ?? []).find(
                    (a) => a.legType === 'PICKUP' && a.subOrderNumber === s.subOrderNumber,
                  );
                  const legState = vendorLegState(s.status, vendorPickup);
                  const action = vendorLegAction(legState);
                  const canAssignPickup = !busy && action.kind === 'assign';
                  const canMarkAtHub = !busy && action.kind === 'confirm';
                  return (
                    <div key={s.id} style={subOrderCardStyle(legState)}>
                      <p style={styles.shopName}>🏪 {s.shopName}</p>
                      <p style={styles.cardTitle}>
                        Bag {s.subOrderNumber.split('-').pop() || s.subOrderNumber}
                      </p>
                      <p style={styles.meta}>
                        {s.subtotalLabel} · {s.itemCount} item{s.itemCount === 1 ? '' : 's'}
                      </p>
                      <p
                        style={
                          legState === 'ready' || legState === 'at_hub'
                            ? styles.statusReady
                            : legState === 'awaiting_vendor'
                              ? styles.statusWaiting
                              : styles.statusInProgress
                        }
                      >
                        {vendorLegHint(legState)}
                      </p>
                      <p
                        style={
                          legState === 'at_hub'
                            ? styles.statusPillDone
                            : legState === 'ready' || legState === 'agent_collecting'
                              ? styles.statusPillActive
                              : styles.statusPill
                        }
                      >
                        {vendorLegStatusLabel(legState)}
                      </p>
                      {vendorPickup ? (
                        <ActionTimeline
                          compact
                          events={vendorPickup.events}
                          assignedAt={vendorPickup.assignedAt}
                          startedAt={vendorPickup.startedAt}
                          completedAt={vendorPickup.completedAt}
                        />
                      ) : null}
                      {action.kind !== 'none' ? (
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            style={
                              action.kind === 'confirm'
                                ? styles.hubConfirm
                                : { ...styles.pickupReady, opacity: busy ? 0.7 : 1 }
                            }
                            disabled={action.kind === 'assign' ? !canAssignPickup : !canMarkAtHub}
                            onClick={() =>
                              void (action.kind === 'assign'
                                ? doAssignPickup(s.id)
                                : doMarkAtHub(s.id))
                            }
                          >
                            {action.label}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div style={{ ...styles.legSection, marginTop: '1.25rem' }}>
                <h3 style={styles.h3}>
                  <span style={styles.legBuyer}>Step 2 — Send order to customer home</span>
                </h3>
                {detail.status === 'DELIVERED' ? (
                  <div style={styles.lastMileCard}>
                    <p style={styles.meta}>Order already reached the customer home.</p>
                  </div>
                ) : (
                  (() => {
                    const assignments = detail.assignments ?? [];
                    const vendorLegDone = allVendorPickupsComplete(subOrders, assignments);
                    const lastMile = lastMileAssignment(assignments);
                    const atHubCount = subOrders.filter((s) =>
                      assignments.some(
                        (a) =>
                          a.legType === 'PICKUP' &&
                          a.status === 'COMPLETED' &&
                          a.subOrderNumber === s.subOrderNumber,
                      ),
                    ).length;
                    const lastMileDone = lastMile?.status === 'COMPLETED';
                    const canAssignDelivery = vendorLegDone && !busy && !lastMile;
                    return (
                      <div style={styles.lastMileCard}>
                        <p style={styles.meta}>
                          {lastMileDone
                            ? 'Boy finished — order delivered at home.'
                            : vendorLegDone
                              ? 'All bags are at the hub. Now send a boy to the customer home.'
                              : `Wait until all bags reach hub (${atHubCount} of ${subOrders.length} here).`}
                        </p>
                        <button
                          type="button"
                          style={canAssignDelivery ? styles.deliveryReady : styles.deliveryWaiting}
                          disabled={!canAssignDelivery}
                          onClick={() => void doAssignLastMile(detail.orderId)}
                        >
                          {lastMile
                            ? `Boy sent to home (${assignmentStatusPlain(lastMile.status)})`
                            : 'Send boy to customer home'}
                        </button>
                        {lastMile ? (
                          <ActionTimeline
                            events={lastMile.events}
                            assignedAt={lastMile.assignedAt}
                            startedAt={lastMile.startedAt}
                            completedAt={lastMile.completedAt}
                          />
                        ) : null}
                      </div>
                    );
                  })()
                )}
              </div>

              {(detail.assignments ?? []).length > 0 ? (
                <>
                  <button
                    type="button"
                    style={styles.historyToggle}
                    onClick={() => setShowHistory((v) => !v)}
                  >
                    {showHistory ? 'Hide' : 'Show'} trip list ({(detail.assignments ?? []).length})
                  </button>
                  {showHistory
                    ? (detail.assignments ?? []).map((a) => (
                        <div key={a.assignmentId} style={styles.historyCard}>
                          <p style={styles.meta}>
                            <span style={assignmentLegStyle(a.legType)}>{legLabel(a.legType)}</span>
                            {' · '}
                            <strong>{a.assignmentNumber}</strong> · {assignmentStatusPlain(a.status)}
                            {a.subOrderNumber ? ` · bag ${a.subOrderNumber}` : ''}
                          </p>
                          <ActionTimeline
                            events={a.events}
                            assignedAt={a.assignedAt}
                            startedAt={a.startedAt}
                            completedAt={a.completedAt}
                          />
                        </div>
                      ))
                    : (() => {
                        const active = (detail.assignments ?? []).filter(
                          (a) => a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS',
                        );
                        if (active.length === 0) {
                          return <p style={styles.muted}>No boy is on a trip for this order right now.</p>;
                        }
                        return active.map((a) => (
                          <div key={a.assignmentId} style={styles.historyCard}>
                            <p style={styles.meta}>
                              <span style={assignmentLegStyle(a.legType)}>{legLabel(a.legType)}</span>
                              {' · '}
                              <strong>{a.assignmentNumber}</strong> · {assignmentStatusPlain(a.status)}
                              {a.subOrderNumber ? ` · bag ${a.subOrderNumber}` : ''}
                            </p>
                            <ActionTimeline
                              compact
                              events={a.events}
                              assignedAt={a.assignedAt}
                              startedAt={a.startedAt}
                              completedAt={a.completedAt}
                            />
                          </div>
                        ));
                      })()}
                </>
              ) : null}
            </div>
          )}
        </div>
        ) : null}
      </section>
    </HubShell>
  );
}

function Stat({
  icon,
  value,
  title,
  help,
  tone,
}: {
  icon: string;
  value: string;
  title: string;
  help: string;
  tone: 'go' | 'info' | 'ok' | 'warn';
}) {
  const toneStyle =
    tone === 'go'
      ? styles.statGo
      : tone === 'warn'
        ? styles.statWarn
        : tone === 'ok'
          ? styles.statOk
          : styles.statInfo;
  return (
    <div style={{ ...styles.stat, ...toneStyle }}>
      <div style={styles.statTop}>
        <span style={styles.statIcon} aria-hidden>
          {icon}
        </span>
        <p style={styles.statValue}>{value}</p>
      </div>
      <p style={styles.statTitle}>{title}</p>
      <p style={styles.statHelp}>{help}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  howto: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem 1.1rem',
  },
  howtoTitle: {
    margin: '0 0 0.75rem',
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.05rem',
  },
  howtoSteps: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.75rem',
  },
  howtoStepsMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.65rem',
  },
  howtoStep: { display: 'flex', gap: '0.65rem', alignItems: 'flex-start' },
  howtoNum: {
    width: 28,
    height: 28,
    borderRadius: '999px',
    background: 'var(--accent)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    flexShrink: 0,
  },
  howtoText: { margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.85rem',
  },
  statsMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.65rem',
  },
  stat: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    display: 'grid',
    gap: '0.25rem',
  },
  statGo: { borderColor: 'rgba(129, 199, 132, 0.7)', background: 'rgba(129, 199, 132, 0.08)' },
  statInfo: { borderColor: 'rgba(66, 165, 245, 0.5)', background: 'rgba(66, 165, 245, 0.06)' },
  statOk: { borderColor: 'var(--border)' },
  statWarn: { borderColor: 'rgba(255, 183, 77, 0.7)', background: 'rgba(255, 183, 77, 0.08)' },
  statTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' },
  statIcon: { fontSize: '1.35rem' },
  statValue: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.85rem',
    fontWeight: 800,
    lineHeight: 1,
  },
  statTitle: { margin: 0, fontWeight: 800, fontSize: '0.95rem' },
  statHelp: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 1fr) minmax(280px, 1.2fr)',
    gap: '1.25rem',
  },
  splitMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '0.25rem',
  },
  backBtn: {
    border: '2px solid var(--border)',
    borderRadius: 12,
    padding: '0.55rem 0.85rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  h2: { margin: '0 0 0.75rem', fontSize: '1.15rem', fontWeight: 800 },
  h3: { margin: '0 0 0.5rem', fontSize: '1rem' },
  legSection: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.85rem',
    marginTop: '0.75rem',
  },
  legHintBlock: { margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  legVendor: {
    display: 'inline-block',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    background: 'rgba(129, 199, 132, 0.2)',
    color: 'var(--success)',
    fontWeight: 800,
    fontSize: '0.9rem',
  },
  legBuyer: {
    display: 'inline-block',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    background: 'rgba(66, 165, 245, 0.2)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.9rem',
  },
  lastMileCard: {
    border: '1px solid rgba(66, 165, 245, 0.35)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.85rem',
    background: 'rgba(66, 165, 245, 0.08)',
    marginTop: '0.5rem',
  },
  deliveryReady: {
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.85rem 1rem',
    marginTop: '0.75rem',
    width: '100%',
    minHeight: 'var(--touch-min)',
    background: 'var(--accent)',
    color: '#0c1218',
    fontWeight: 800,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  deliveryWaiting: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.85rem 1rem',
    marginTop: '0.75rem',
    width: '100%',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'not-allowed',
  },
  hubConfirm: {
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.85rem 1rem',
    width: '100%',
    minHeight: 'var(--touch-min)',
    background: 'var(--success)',
    color: '#0f1a10',
    fontWeight: 800,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  list: { display: 'grid', gap: '0.55rem' },
  order: {
    textAlign: 'left',
    display: 'grid',
    gap: '0.25rem',
    padding: '0.95rem 1rem',
    borderRadius: 'var(--radius-md)',
    border: '2px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  orderActive: {
    textAlign: 'left',
    display: 'grid',
    gap: '0.25rem',
    padding: '0.95rem 1rem',
    borderRadius: 'var(--radius-md)',
    border: '2px solid var(--accent)',
    background: 'rgba(66, 165, 245, 0.12)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  orderNo: { fontSize: '1rem', fontFamily: 'var(--font-display)' },
  bagCount: { fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  detail: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
  },
  detailTitle: { margin: 0, fontWeight: 800, fontSize: '1.15rem', fontFamily: 'var(--font-display)' },
  detailMoney: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontWeight: 700 },
  timeLine: { margin: '0.2rem 0 0', color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem' },
  historyCard: {
    marginTop: '0.55rem',
    padding: '0.65rem 0.75rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  deliveredBanner: {
    margin: '0.75rem 0 0',
    padding: '0.7rem 0.85rem',
    borderRadius: 12,
    background: 'rgba(129, 199, 132, 0.18)',
    border: '1px solid rgba(129, 199, 132, 0.55)',
    color: 'var(--success)',
    fontWeight: 800,
  },
  cancelledBanner: {
    margin: '0.75rem 0 0',
    padding: '0.7rem 0.85rem',
    borderRadius: 12,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
  },
  emptyBox: {
    margin: 0,
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.85rem',
    marginTop: '0.55rem',
  },
  cardWaiting: {
    borderColor: 'var(--danger)',
    background: 'rgba(229, 115, 115, 0.08)',
  },
  cardReady: {
    borderColor: 'var(--success)',
    background: 'rgba(129, 199, 132, 0.12)',
  },
  cardAtHub: {
    borderColor: 'var(--success)',
    background: 'rgba(129, 199, 132, 0.05)',
  },
  cardInProgress: {
    borderColor: 'var(--warning)',
    background: 'rgba(255, 183, 77, 0.08)',
  },
  shopName: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.15rem',
    color: 'var(--text)',
  },
  cardTitle: { margin: '0.2rem 0 0', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem' },
  badgeWaiting: {
    margin: '0.2rem 0 0',
    display: 'inline-block',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--danger)',
  },
  badgePartial: {
    margin: '0.2rem 0 0',
    display: 'inline-block',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--warning)',
  },
  badgeReady: {
    margin: '0.2rem 0 0',
    display: 'inline-block',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--success)',
  },
  statusWaiting: { margin: '0.4rem 0 0', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 700 },
  statusReady: { margin: '0.4rem 0 0', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 700 },
  statusInProgress: { margin: '0.4rem 0 0', color: 'var(--warning)', fontSize: '0.9rem', fontWeight: 700 },
  statusPill: {
    margin: '0.5rem 0 0',
    display: 'inline-block',
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 700,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
  },
  statusPillActive: {
    margin: '0.5rem 0 0',
    display: 'inline-block',
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 700,
    background: 'rgba(129, 199, 132, 0.2)',
    color: 'var(--success)',
  },
  statusPillDone: {
    margin: '0.5rem 0 0',
    display: 'inline-block',
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 700,
    background: 'rgba(129, 199, 132, 0.15)',
    color: 'var(--success)',
  },
  pickupReady: {
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    width: '100%',
    minHeight: 'var(--touch-min)',
    background: 'var(--success)',
    color: '#0f1a10',
    fontWeight: 800,
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  meta: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 600 },
  rowActions: { display: 'flex', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700 },
  notice: { margin: 0, color: 'var(--success)', fontWeight: 700 },
  muted: { color: 'var(--text-muted)', fontWeight: 600 },
  historyToggle: {
    margin: '1rem 0 0.5rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
  },
};
