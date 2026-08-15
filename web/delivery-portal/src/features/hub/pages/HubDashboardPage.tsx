import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActionTimeline } from '@/shared/components/ActionTimeline';
import { PaginationBar } from '@/shared/components/PaginationBar';
import { WorklistToolbar } from '@/shared/components/WorklistToolbar';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { formatPortalTime } from '@/shared/time/formatPortalTime';
import { HubShell } from '../layout/HubShell';
import { useHubWorkspace, type HubOrderTab } from '../hooks/useHubWorkspace';
import { AgentPickDialog } from '../components/AgentPickDialog';
import { ConfirmAtHubDialog } from '../components/ConfirmAtHubDialog';
import { ConfirmVendorAlertDialog } from '../components/ConfirmVendorAlertDialog';
import type { OrderRowView } from '../api/hubApi';

type AgentPrompt =
  | { kind: 'pickup'; subOrderId: string; shopName: string }
  | { kind: 'lastMile'; orderId: string; orderNumber: string }
  | { kind: 'reassign'; assignmentId: string; currentAgentId: string; label: string }
  | null;

type AtHubPrompt = { subOrderId: string; shopName: string } | null;
type AlertPrompt = { subOrderId: string; shopName: string; bagNumber: string } | null;

type PickupUiState =
  | 'awaiting_vendor'
  | 'ready'
  | 'agent_assigned'
  | 'agent_collecting'
  | 'at_hub'
  | 'rejected';

function isActiveSubOrder(status: string): boolean {
  return status !== 'VENDOR_REJECTED';
}

function vendorLegState(
  status: string,
  assignment?: { status: string },
): PickupUiState {
  if (status === 'VENDOR_REJECTED') return 'rejected';
  if (status === 'DELIVERED') return 'at_hub';
  if (status === 'PLACED') return 'awaiting_vendor';
  if (assignment?.status === 'COMPLETED') return 'at_hub';
  if (assignment?.status === 'IN_PROGRESS') return 'agent_collecting';
  if (assignment?.status === 'ASSIGNED') return 'agent_assigned';
  if (status === 'READY_FOR_PICKUP') return 'ready';
  return 'awaiting_vendor';
}

function subOrderCardStyle(state: PickupUiState): CSSProperties {
  if (state === 'ready') return { ...styles.card, ...styles.cardReady };
  if (state === 'awaiting_vendor') return { ...styles.card, ...styles.cardWaiting };
  if (state === 'at_hub') return { ...styles.card, ...styles.cardAtHub };
  if (state === 'rejected') return { ...styles.card, ...styles.cardRejected };
  return { ...styles.card, ...styles.cardInProgress };
}

type HubPhase = {
  /** Short status on the left list (not a button). */
  listStatus: string;
  /** Same idea, one clear line on the right. */
  detailNow: string;
  /** Primary tap label — only when hub staff must act. */
  doButton: string | null;
  tone: 'wait' | 'go' | 'partial' | 'done' | 'progress';
};

/** One shared story for list + detail — simple words for hub staff. */
function hubPhase(order: OrderRowView): HubPhase {
  if (order.status === 'DELIVERED') {
    return {
      listStatus: 'Done',
      detailNow: 'Order finished. Customer has the bag.',
      doButton: null,
      tone: 'done',
    };
  }
  if (order.status === 'CANCELLED') {
    return {
      listStatus: 'Cancelled',
      detailNow: 'Order cancelled. Nothing to do.',
      doButton: null,
      tone: 'wait',
    };
  }

  const total = order.subOrderCount;
  const ready = order.readySubOrderCount;
  const atHub = order.atHubSubOrderCount;
  const assignments = order.assignments ?? [];
  const lastMile = assignments.find((a) => a.legType === 'LAST_MILE');
  const pickupInProgress = assignments.some(
    (a) => a.legType === 'PICKUP' && a.status === 'IN_PROGRESS',
  );
  const pickupAssigned = assignments.some(
    (a) => a.legType === 'PICKUP' && a.status === 'ASSIGNED',
  );

  if (total > 0 && atHub >= total) {
    if (lastMile?.status === 'IN_PROGRESS') {
      return {
        listStatus: 'WAIT · Going to customer',
        detailNow: 'Wait. Agent is taking the order to the customer home.',
        doButton: null,
        tone: 'progress',
      };
    }
    if (lastMile?.status === 'ASSIGNED') {
      return {
        listStatus: 'WAIT · Agent for home',
        detailNow: 'Wait. Agent is assigned for home. They will leave the hub soon.',
        doButton: null,
        tone: 'progress',
      };
    }
    return {
      listStatus: 'DO · Send home',
      detailNow: 'All bags are at hub. Your next tap: send agent to customer home.',
      doButton: 'Send agent to home',
      tone: 'go',
    };
  }

  if (pickupInProgress) {
    return {
      listStatus: 'DO · Bag at hub',
      detailNow: 'Agent already took the bag from shop. When bag reaches hub, tap below.',
      doButton: 'Bag reached hub ✓',
      tone: 'go',
    };
  }

  if (atHub > 0 && atHub < total) {
    if (pickupAssigned) {
      return {
        listStatus: 'WAIT · More bags',
        detailNow: `${atHub} of ${total} bags at hub. Wait for agent at the other shop.`,
        doButton: null,
        tone: 'progress',
      };
    }
    if (ready > 0) {
      return {
        listStatus: 'DO · Send to shop',
        detailNow: `${atHub} of ${total} bags at hub. Send agent to the shop that is ready.`,
        doButton: 'Send agent to shop',
        tone: 'partial',
      };
    }
    return {
      listStatus: 'WAIT · More bags',
      detailNow: `${atHub} of ${total} bags at hub. Wait for other shops to pack.`,
      doButton: null,
      tone: 'partial',
    };
  }

  if (pickupAssigned) {
    return {
      listStatus: 'WAIT · Agent to shop',
      detailNow: 'Wait. Agent is going to the shop to take the bag.',
      doButton: null,
      tone: 'progress',
    };
  }

  if (order.pickupReadiness === 'none') {
    return {
      listStatus: 'WAIT · Shop packing',
      detailNow: 'Wait. Shop is still packing. Do not send agent yet.',
      doButton: null,
      tone: 'wait',
    };
  }

  return {
    listStatus: 'DO · Send to shop',
    detailNow: 'Shop packed the bag. Your next tap: send agent to shop.',
    doButton: 'Send agent to shop',
    tone: ready > 0 && ready < total ? 'partial' : 'go',
  };
}

function orderRowStyle(order: OrderRowView, selected: boolean): CSSProperties {
  const base = selected ? styles.orderActive : styles.order;
  const phase = hubPhase(order);
  if (order.status === 'DELIVERED') {
    return { ...base, borderColor: 'var(--success)', background: 'rgba(129, 199, 132, 0.1)' };
  }
  if (order.status === 'CANCELLED') {
    return { ...base, borderColor: 'var(--border)', background: 'var(--bg-muted)' };
  }
  if (phase.tone === 'progress') {
    return { ...base, borderColor: 'var(--warning)', background: 'rgba(255, 183, 77, 0.12)' };
  }
  if (phase.tone === 'go') {
    return { ...base, borderColor: 'var(--success)', background: 'rgba(129, 199, 132, 0.1)' };
  }
  if (phase.tone === 'partial' || order.atHubSubOrderCount > 0) {
    return { ...base, borderColor: 'var(--warning)', background: 'rgba(255, 183, 77, 0.1)' };
  }
  return { ...base, borderColor: 'var(--danger)', background: 'rgba(229, 115, 115, 0.08)' };
}

function vendorLegStatusLabel(state: PickupUiState): string {
  switch (state) {
    case 'awaiting_vendor':
      return 'Shop packing';
    case 'ready':
      return 'Shop ready';
    case 'agent_assigned':
      return 'Agent going to shop';
    case 'agent_collecting':
      return 'Bag coming to hub';
    case 'at_hub':
      return 'Bag at hub';
    case 'rejected':
      return 'Shop cancelled';
  }
}

type VendorLegAction =
  | { kind: 'none' }
  | { kind: 'assign'; label: string }
  | { kind: 'confirm'; label: string };

function vendorLegAction(state: PickupUiState): VendorLegAction {
  switch (state) {
    case 'ready':
      return { kind: 'assign', label: 'Send agent to shop' };
    case 'agent_collecting':
      return { kind: 'confirm', label: 'Bag reached hub ✓' };
    default:
      return { kind: 'none' };
  }
}

function vendorLegHint(state: PickupUiState): string | null {
  switch (state) {
    case 'awaiting_vendor':
      return 'wait — shop packing';
    case 'agent_assigned':
      return 'wait — agent going to shop';
    case 'rejected':
      return 'not needed';
    default:
      return null;
  }
}

function legLabel(legType: string): string {
  return legType === 'PICKUP' ? 'Shop → Hub' : 'Hub → Home';
}

function assignmentLegStyle(legType: string): CSSProperties {
  return legType === 'PICKUP' ? styles.legVendor : styles.legBuyer;
}

function assignmentStatusPlain(status: string): string {
  if (status === 'ASSIGNED') return 'Agent sent';
  if (status === 'IN_PROGRESS') return 'Agent on the way';
  if (status === 'COMPLETED') return 'Done';
  return status;
}

function allVendorPickupsComplete(
  subOrders: { subOrderNumber: string; status: string }[],
  assignments: Array<{ legType: string; status: string; subOrderNumber?: string | null }>,
): boolean {
  const active = subOrders.filter((sub) => isActiveSubOrder(sub.status));
  if (active.length === 0) return false;
  return active.every(
    (sub) =>
      sub.status === 'DELIVERED' ||
      assignments.some(
        (a) =>
          a.legType === 'PICKUP' &&
          a.status === 'COMPLETED' &&
          a.subOrderNumber === sub.subOrderNumber,
      ),
  );
}

function countBagsAtHub(
  subOrders: { subOrderNumber: string; status: string }[],
  assignments: Array<{ legType: string; status: string; subOrderNumber?: string | null }>,
): { atHub: number; active: number } {
  const active = subOrders.filter((sub) => isActiveSubOrder(sub.status));
  const atHub = active.filter(
    (sub) =>
      sub.status === 'DELIVERED' ||
      assignments.some(
        (a) =>
          a.legType === 'PICKUP' &&
          a.status === 'COMPLETED' &&
          a.subOrderNumber === sub.subOrderNumber,
      ),
  ).length;
  return { atHub, active: active.length };
}

function lastMileAssignment(
  assignments: Array<{
    assignmentId: string;
    agentId: string;
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
    agents,
    lastAgentId,
    agentLabel,
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
    doReassign,
    doAlertVendor,
  } = useHubWorkspace();

  const isMobile = useIsMobile();
  const detailRef = useRef<HTMLDivElement>(null);
  const showMobileDetail = isMobile && Boolean(detail);
  const [agentPrompt, setAgentPrompt] = useState<AgentPrompt>(null);
  const [atHubPrompt, setAtHubPrompt] = useState<AtHubPrompt>(null);
  const [alertPrompt, setAlertPrompt] = useState<AlertPrompt>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [openItemBags, setOpenItemBags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenItemBags({});
    setAtHubPrompt(null);
    setAlertPrompt(null);
    setAlertError(null);
  }, [selectedOrderId]);

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
      onRefresh={() => void reload()}
    >
      {loading && !dashboard ? <p style={styles.muted}>Loading…</p> : null}

      {!isMobile ? (
        <section style={styles.howto} aria-label="How delivery works">
          <p style={styles.howtoTitle}>Simple rule</p>
          <p style={styles.howtoText}>
            Tap an order on the left. On the right, follow <strong>YOU DO THIS</strong> or{' '}
            <strong>ONLY WAIT</strong>.
          </p>
        </section>
      ) : (
        <p style={styles.howtoMobile}>
          Tap an order → follow <strong>YOU DO THIS</strong> or <strong>ONLY WAIT</strong>.
        </p>
      )}

      {dashboard ? (
        <section style={isMobile ? styles.statsMobile : styles.stats} aria-label="Today numbers">
          <Stat
            icon="🛍️"
            value={String(dashboard.readyForPickup)}
            title="Ready at shop"
            help="Shop packed — send delivery agent to shop"
            tone="go"
          />
          <Stat
            icon="🏠"
            value={String(dashboard.awaitingDelivery)}
            title="Still open"
            help="Not finished — customer waiting"
            tone="info"
          />
          <Stat
            icon="🛵"
            value={String(dashboard.activeAgents)}
            title="Agents free"
            help="Delivery agents ready for work"
            tone="ok"
          />
          <Stat
            icon="📦"
            value={String(dashboard.activeAssignments)}
            title="On a trip"
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
            <h2 style={isMobile ? styles.h2Mobile : styles.h2}>Order list</h2>
            <WorklistToolbar
              tabs={hubTabs}
              activeTab={orderTab}
              onTabChange={(id) => changeTab(id as HubOrderTab)}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Type order number here…"
              hint={
                orderTab === 'action'
                  ? 'Orders that need your work. Tap one to open.'
                  : orderTab === 'vendor-wait'
                    ? 'Shops still packing. Wait — do not send agent.'
                    : 'All open orders.'
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
                  const phase = hubPhase(o);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      style={orderRowStyle(o, selectedOrderId === o.id)}
                      onClick={() => void openOrder(o.id)}
                      title={`${o.orderNumber} · ${phase.detailNow}`}
                    >
                      <strong style={styles.orderNo}>{o.orderNumber}</strong>
                      <span style={styles.orderMeta}>
                        {o.totalLabel} · {o.subOrderCount} bag
                        {o.subOrderCount === 1 ? '' : 's'}
                        {o.rejectedSubOrderCount > 0
                          ? ` · ${o.rejectedSubOrderCount} shop rejected`
                          : ''}
                        {o.atHubSubOrderCount > 0
                          ? ` · ${o.atHubSubOrderCount}/${o.subOrderCount} at hub`
                          : ''}
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
            <h2 style={{ ...styles.h2, margin: 0, fontSize: '0.95rem' }}>Order detail</h2>
            {showMobileDetail ? (
              <button type="button" style={styles.backBtn} onClick={clearOrderSelection}>
                ← All orders
              </button>
            ) : null}
          </div>
          {!detail ? (
            <p style={styles.emptyBox}>← Tap an order on the left. Then do the big button here.</p>
          ) : (
            <div style={styles.detail}>
              <div style={styles.detailTop}>
                <p style={styles.detailTitle}>{detail.orderNumber}</p>
                <p style={styles.detailMoney}>
                  ₹{Number(detail.totalAmount).toFixed(2)} · COD
                  {detail.placedAt ? ` · ${formatPortalTime(detail.placedAt)}` : ''}
                  {detail.deliveredAt ? ` · delivered ${formatPortalTime(detail.deliveredAt)}` : ''}
                </p>
              </div>
              {(() => {
                const selectedRow = orders.find((o) => o.id === detail.orderId);
                const phase = selectedRow
                  ? hubPhase(selectedRow)
                  : {
                      listStatus: '',
                      detailNow: 'Loading…',
                      doButton: null as string | null,
                      tone: 'wait' as const,
                    };
                return (
                  <div
                    style={
                      phase.doButton
                        ? styles.nextStepGo
                        : phase.tone === 'progress' || phase.tone === 'partial'
                          ? styles.nextStepWait
                          : styles.nextStepWait
                    }
                  >
                    <p style={styles.nextStepLabel}>{phase.doButton ? 'YOU DO THIS' : 'ONLY WAIT'}</p>
                    <p style={styles.nextStepText}>{phase.detailNow}</p>
                  </div>
                );
              })()}
              {detail.status === 'DELIVERED' ? (
                <p style={styles.deliveredBanner}>Delivered ✓ — nothing left to do</p>
              ) : null}
              {detail.status === 'CANCELLED' ? (
                <p style={styles.cancelledBanner}>Cancelled</p>
              ) : null}

              <div style={styles.legSection}>
                <p style={styles.legTitle}>
                  <span style={styles.legVendor}>1 · Shop → Hub</span>
                </p>
                {subOrders.map((s) => {
                  const vendorPickup = (detail.assignments ?? []).find(
                    (a) => a.legType === 'PICKUP' && a.subOrderNumber === s.subOrderNumber,
                  );
                  const legState = vendorLegState(s.status, vendorPickup);
                  const action = vendorLegAction(legState);
                  const hint = vendorLegHint(legState);
                  const canAssignPickup = !busy && action.kind === 'assign';
                  const canMarkAtHub = !busy && action.kind === 'confirm';
                  const alertPending = s.vendorAlert?.status === 'PENDING';
                  const canAlertVendor = !busy && legState === 'awaiting_vendor' && !alertPending;
                  const canChangeBoy =
                    Boolean(vendorPickup) &&
                    (vendorPickup?.status === 'ASSIGNED' || vendorPickup?.status === 'IN_PROGRESS') &&
                    !busy;
                  const pillStyle =
                    legState === 'at_hub'
                      ? styles.statusPillDone
                      : legState === 'rejected'
                        ? styles.statusPillRejected
                        : legState === 'agent_assigned'
                          ? styles.statusPillGoing
                          : legState === 'ready' || legState === 'agent_collecting'
                            ? styles.statusPillActive
                            : styles.statusPill;
                  return (
                    <div key={s.id} style={subOrderCardStyle(legState)}>
                      <div style={styles.cardHead}>
                        <p style={styles.shopName}>{s.shopName}</p>
                        <span style={pillStyle}>{vendorLegStatusLabel(legState)}</span>
                      </div>
                      <p style={styles.meta}>
                        {s.subtotalLabel}
                        {' · '}
                        <button
                          type="button"
                          style={styles.itemsToggleInline}
                          onClick={() =>
                            setOpenItemBags((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                          }
                          aria-expanded={Boolean(openItemBags[s.id])}
                        >
                          {openItemBags[s.id] ? '▾' : '▸'} {s.itemCount} item
                          {s.itemCount === 1 ? '' : 's'}
                        </button>
                        {vendorPickup ? ` · ${agentLabel(vendorPickup.agentId)}` : ''}
                        {hint ? ` · ${hint}` : ''}
                      </p>
                      {openItemBags[s.id] ? (
                        s.items.length > 0 ? (
                          <ul style={styles.itemList}>
                            {s.items.map((item, idx) => (
                              <li key={`${s.id}-${item.name}-${idx}`} style={styles.itemRow}>
                                <span>
                                  {item.quantity}
                                  {item.unitCode ? ` ${item.unitCode.toLowerCase()}` : ''} × {item.name}
                                </span>
                                {item.lineTotalLabel ? (
                                  <span style={styles.itemAmt}>{item.lineTotalLabel}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={styles.meta}>Items not available.</p>
                        )
                      ) : null}
                      {vendorPickup ? (
                        <div style={styles.tripBlock}>
                          <ActionTimeline
                            compact
                            events={vendorPickup.events}
                            assignedAt={vendorPickup.assignedAt}
                            startedAt={vendorPickup.startedAt}
                            completedAt={vendorPickup.completedAt}
                            resolveAgentName={(id) => agentLabel(id)}
                          />
                        </div>
                      ) : null}
                      {action.kind !== 'none' || canChangeBoy || canAlertVendor || alertPending || s.vendorAlert ? (
                        <div style={styles.rowActions}>
                          {canChangeBoy && vendorPickup ? (
                            <button
                              type="button"
                              style={
                                action.kind !== 'none' ? styles.changeBoyBtnInline : styles.changeBoyBtn
                              }
                              onClick={() =>
                                setAgentPrompt({
                                  kind: 'reassign',
                                  assignmentId: vendorPickup.assignmentId,
                                  currentAgentId: vendorPickup.agentId,
                                  label: `${s.shopName} shop pickup`,
                                })
                              }
                            >
                              Change agent
                            </button>
                          ) : null}
                          {action.kind !== 'none' ? (
                            <button
                              type="button"
                              style={
                                action.kind === 'confirm'
                                  ? styles.hubConfirm
                                  : { ...styles.pickupReady, opacity: busy ? 0.7 : 1 }
                              }
                              disabled={action.kind === 'assign' ? !canAssignPickup : !canMarkAtHub}
                              onClick={() => {
                                if (action.kind === 'assign') {
                                  setAgentPrompt({
                                    kind: 'pickup',
                                    subOrderId: s.id,
                                    shopName: s.shopName,
                                  });
                                  return;
                                }
                                setAtHubPrompt({ subOrderId: s.id, shopName: s.shopName });
                              }}
                            >
                              {action.label}
                            </button>
                          ) : null}
                          {legState === 'awaiting_vendor' ? (
                            alertPending ? (
                              <span style={styles.alertWaiting}>Waiting for vendor notice</span>
                            ) : (
                              <button
                                type="button"
                                style={{ ...styles.alertVendorBtn, opacity: busy ? 0.7 : 1 }}
                                disabled={!canAlertVendor}
                                onClick={() =>
                                  setAlertPrompt({
                                    subOrderId: s.id,
                                    shopName: s.shopName,
                                    bagNumber: s.subOrderNumber,
                                  })
                                }
                              >
                                Alert vendor
                              </button>
                            )
                          ) : null}
                          {s.vendorAlert?.status === 'ACKNOWLEDGED' && s.vendorAlert.acknowledgedAt && !alertPending ? (
                            <span style={styles.alertNoticed}>
                              Noticed {formatPortalTime(s.vendorAlert.acknowledgedAt)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {(() => {
                const assignments = detail.assignments ?? [];
                const vendorLegDone =
                  detail.status === 'DELIVERED' ||
                  allVendorPickupsComplete(subOrders, assignments);
                const lastMile = lastMileAssignment(assignments);
                const { atHub: atHubCount, active: activeBagCount } = countBagsAtHub(
                  subOrders,
                  assignments,
                );
                const lastMileDone = lastMile?.status === 'COMPLETED';
                const canAssignDelivery = vendorLegDone && !busy && !lastMile && detail.status !== 'DELIVERED';
                const homeActive = vendorLegDone || Boolean(lastMile) || detail.status === 'DELIVERED';

                if (!homeActive) {
                  return (
                    <div style={styles.legSectionCollapsed}>
                      <span style={styles.legBuyer}>2 · Home delivery</span>
                      <span style={styles.legCollapsedHint}>
                        Later · bags at hub {atHubCount}/{activeBagCount}
                      </span>
                    </div>
                  );
                }

                return (
                  <div style={{ ...styles.legSection, marginTop: '0.55rem' }}>
                    <p style={styles.legTitle}>
                      <span style={styles.legBuyer}>2 · Home delivery</span>
                    </p>
                    {detail.status === 'DELIVERED' ? (
                      <div style={styles.lastMileCard}>
                        <p style={styles.meta}>Already at customer home.</p>
                      </div>
                    ) : (
                      <div style={styles.lastMileCard}>
                        <p style={styles.meta}>
                          {lastMileDone
                            ? 'Delivered at customer home.'
                            : lastMile
                              ? lastMile.status === 'IN_PROGRESS'
                                ? 'Wait — agent is going to customer home.'
                                : 'Wait — agent assigned for home. They will leave hub soon.'
                              : 'All bags at hub. Tap the button to send agent home.'}
                        </p>
                        {canAssignDelivery ? (
                          <button
                            type="button"
                            style={styles.deliveryReady}
                            onClick={() =>
                              setAgentPrompt({
                                kind: 'lastMile',
                                orderId: detail.orderId,
                                orderNumber: detail.orderNumber,
                              })
                            }
                          >
                            Send agent to home
                          </button>
                        ) : lastMile && !lastMileDone ? (
                          <p style={styles.statusInProgress}>
                            {lastMile.status === 'IN_PROGRESS'
                              ? 'Going to customer'
                              : 'Agent assigned for home'}
                            {' · '}
                            {agentLabel(lastMile.agentId)}
                          </p>
                        ) : null}
                        {lastMile ? (
                          <>
                            {lastMileDone ? (
                              <p style={styles.boyLine}>{agentLabel(lastMile.agentId)}</p>
                            ) : null}
                            <ActionTimeline
                              compact
                              events={lastMile.events}
                              assignedAt={lastMile.assignedAt}
                              startedAt={lastMile.startedAt}
                              completedAt={lastMile.completedAt}
                              resolveAgentName={(id) => agentLabel(id)}
                            />
                            {(lastMile.status === 'ASSIGNED' || lastMile.status === 'IN_PROGRESS') &&
                            !busy ? (
                              <button
                                type="button"
                                style={styles.changeBoyBtn}
                                onClick={() =>
                                  setAgentPrompt({
                                    kind: 'reassign',
                                    assignmentId: lastMile.assignmentId,
                                    currentAgentId: lastMile.agentId,
                                    label: 'home delivery',
                                  })
                                }
                              >
                                Change agent
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })()}

              {(detail.assignments ?? []).length > 0 ? (
                <>
                  <button
                    type="button"
                    style={styles.historyToggle}
                    onClick={() => setShowHistory((v) => !v)}
                  >
                    {showHistory ? 'Hide' : 'Show'} trip list ({(detail.assignments ?? []).length})
                  </button>
                  {showHistory ? (
                    (detail.assignments ?? []).map((a) => (
                      <div key={a.assignmentId} style={styles.historyCard}>
                        <p style={styles.tripHead}>
                          <span style={assignmentLegStyle(a.legType)}>{legLabel(a.legType)}</span>
                          <span style={styles.tripBill}>
                            {' '}
                            {a.subOrderNumber || a.orderNumber}
                          </span>
                          <span style={styles.tripMeta}>
                            {' · '}
                            {assignmentStatusPlain(a.status)}
                            {' · '}
                            {agentLabel(a.agentId)}
                          </span>
                        </p>
                        <ActionTimeline
                          events={a.events}
                          assignedAt={a.assignedAt}
                          startedAt={a.startedAt}
                          completedAt={a.completedAt}
                          resolveAgentName={(id) => agentLabel(id)}
                        />
                      </div>
                    ))
                  ) : (
                    <p style={styles.tripCollapsedHint}>
                      Tap Show trip list to see Shop → Hub and Hub → Home times.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
        ) : null}
      </section>

      <ConfirmVendorAlertDialog
        open={Boolean(alertPrompt)}
        shopName={alertPrompt?.shopName ?? 'Shop'}
        bagNumber={alertPrompt?.bagNumber}
        busy={busy}
        error={alertError}
        onClose={() => {
          if (!busy) {
            setAlertPrompt(null);
            setAlertError(null);
          }
        }}
        onConfirm={() => {
          if (!alertPrompt) return;
          const subOrderId = alertPrompt.subOrderId;
          setAlertError(null);
          void (async () => {
            const ok = await doAlertVendor(subOrderId);
            if (ok) {
              setAlertPrompt(null);
              setAlertError(null);
            } else {
              setAlertError('Could not alert the vendor. Check that order-service is running, then try again.');
            }
          })();
        }}
      />

      <ConfirmAtHubDialog
        open={Boolean(atHubPrompt)}
        shopName={atHubPrompt?.shopName ?? 'Shop'}
        busy={busy}
        onClose={() => {
          if (!busy) setAtHubPrompt(null);
        }}
        onConfirm={() => {
          if (!atHubPrompt) return;
          const subOrderId = atHubPrompt.subOrderId;
          void (async () => {
            await doMarkAtHub(subOrderId);
            setAtHubPrompt(null);
          })();
        }}
      />

      <AgentPickDialog
        open={Boolean(agentPrompt)}
        title={
          agentPrompt?.kind === 'reassign'
            ? 'Change agent?'
            : agentPrompt?.kind === 'lastMile'
              ? 'Who goes to customer home?'
              : 'Who goes to the shop?'
        }
        description={
          agentPrompt?.kind === 'reassign'
            ? `Move ${agentPrompt.label} to another delivery agent.`
            : agentPrompt?.kind === 'lastMile'
              ? `Pick a delivery agent for ${agentPrompt.orderNumber} home delivery.`
              : agentPrompt?.kind === 'pickup'
                ? `Pick a delivery agent to collect from ${agentPrompt.shopName}.`
                : ''
        }
        confirmLabel={agentPrompt?.kind === 'reassign' ? 'Change agent' : 'Send this agent'}
        agents={agents}
        preferredAgentId={
          agentPrompt?.kind === 'reassign' ? undefined : (lastAgentId ?? undefined)
        }
        excludeAgentId={
          agentPrompt?.kind === 'reassign' ? agentPrompt.currentAgentId : undefined
        }
        busy={busy}
        onClose={() => {
          if (!busy) setAgentPrompt(null);
        }}
        onConfirm={(agentId) => {
          if (!agentPrompt) return;
          const prompt = agentPrompt;
          void (async () => {
            let ok = false;
            if (prompt.kind === 'pickup') {
              ok = await doAssignPickup(prompt.subOrderId, agentId);
            } else if (prompt.kind === 'lastMile') {
              ok = await doAssignLastMile(prompt.orderId, agentId);
            } else {
              ok = await doReassign(prompt.assignmentId, agentId);
            }
            if (ok) setAgentPrompt(null);
          })();
        }}
      />
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
    <div style={{ ...styles.stat, ...toneStyle }} title={help}>
      <span style={styles.statIcon} aria-hidden>
        {icon}
      </span>
      <span style={styles.statTitle}>{title}</span>
      <span style={styles.statValue}>{value}</span>
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
  howtoMobile: {
    margin: 0,
    padding: '0.35rem 0.15rem',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 650,
    lineHeight: 1.3,
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
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.4rem',
  },
  statsMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.35rem',
  },
  stat: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.35rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    minWidth: 0,
  },
  statGo: { borderColor: 'rgba(129, 199, 132, 0.7)', background: 'rgba(129, 199, 132, 0.08)' },
  statInfo: { borderColor: 'rgba(66, 165, 245, 0.5)', background: 'rgba(66, 165, 245, 0.06)' },
  statOk: { borderColor: 'var(--border)' },
  statWarn: { borderColor: 'rgba(255, 183, 77, 0.7)', background: 'rgba(255, 183, 77, 0.08)' },
  statIcon: { fontSize: '0.9rem', lineHeight: 1, flexShrink: 0 },
  statTitle: {
    margin: 0,
    fontWeight: 700,
    fontSize: '0.72rem',
    lineHeight: 1.2,
    minWidth: 0,
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  statValue: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
    lineHeight: 1,
    flexShrink: 0,
  },
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 1fr) minmax(280px, 1.2fr)',
    gap: '1.25rem',
    alignItems: 'start',
  },
  splitMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.65rem',
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
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    padding: '0.45rem 0.75rem',
    minHeight: 'var(--touch-min)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  h2: { margin: '0 0 0.75rem', fontSize: '1.15rem', fontWeight: 800 },
  h2Mobile: { margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 800 },
  h3: { margin: '0 0 0.5rem', fontSize: '1rem' },
  legSection: {
    border: '2px solid #111',
    borderRadius: 10,
    padding: '0.45rem 0.5rem',
    marginTop: '0.45rem',
  },
  legSectionCollapsed: {
    marginTop: '0.45rem',
    padding: '0.35rem 0.5rem',
    borderRadius: 8,
    border: '1.5px dashed #999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
    background: 'var(--bg-muted)',
    opacity: 0.85,
  },
  legCollapsedHint: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 650,
  },
  legTitle: { margin: '0 0 0.3rem' },
  legHintBlock: { margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 },
  legVendor: {
    display: 'inline-block',
    padding: '0.12rem 0.45rem',
    borderRadius: 999,
    background: 'rgba(129, 199, 132, 0.2)',
    color: 'var(--success)',
    fontWeight: 800,
    fontSize: '0.72rem',
  },
  legBuyer: {
    display: 'inline-block',
    padding: '0.12rem 0.45rem',
    borderRadius: 999,
    background: 'rgba(66, 165, 245, 0.2)',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.72rem',
  },
  lastMileCard: {
    border: '2px dotted #111',
    borderRadius: 10,
    padding: '0.45rem 0.55rem',
    background: 'rgba(66, 165, 245, 0.07)',
    marginTop: '0.25rem',
    display: 'grid',
    gap: '0.3rem',
  },
  deliveryReady: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.75rem',
    marginTop: 0,
    width: '100%',
    minHeight: 'var(--touch-min)',
    background: 'var(--accent)',
    color: '#0c1218',
    fontWeight: 800,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  deliveryWaiting: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.75rem',
    marginTop: 0,
    width: '100%',
    minHeight: 'var(--touch-min)',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'not-allowed',
  },
  hubConfirm: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.75rem',
    flex: '1 1 7rem',
    minHeight: 'var(--touch-min)',
    background: '#10B981',
    color: '#0f1a10',
    fontWeight: 800,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  list: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.35rem',
  },
  order: {
    textAlign: 'left',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.1rem',
    alignContent: 'center',
    padding: '0.5rem 0.65rem',
    minHeight: 'var(--touch-min)',
    borderRadius: 10,
    border: '1.5px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  orderActive: {
    textAlign: 'left',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.1rem',
    alignContent: 'center',
    padding: '0.5rem 0.65rem',
    minHeight: 'var(--touch-min)',
    borderRadius: 10,
    border: '1.5px solid var(--accent)',
    background: 'rgba(66, 165, 245, 0.12)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  orderNo: {
    fontSize: '0.82rem',
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    lineHeight: 1.2,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  bagCount: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  orderMeta: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    fontWeight: 600,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  detail: {
    background: 'var(--bg-elevated)',
    border: '2px solid #111',
    borderRadius: 12,
    padding: '0.65rem 0.7rem',
    display: 'grid',
    gap: '0.15rem',
  },
  detailTop: { display: 'grid', gap: '0.1rem' },
  nextStepGo: {
    marginTop: '0.25rem',
    padding: '0.3rem 0.45rem',
    borderRadius: 8,
    border: '1.5px solid var(--success)',
    background: 'rgba(129, 199, 132, 0.12)',
    display: 'grid',
    gap: '0.05rem',
  },
  nextStepWait: {
    marginTop: '0.25rem',
    padding: '0.3rem 0.45rem',
    borderRadius: 8,
    border: '1.5px solid var(--warning)',
    background: 'rgba(255, 183, 77, 0.1)',
    display: 'grid',
    gap: '0.05rem',
  },
  nextStepLabel: {
    margin: 0,
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    color: 'var(--text-muted)',
  },
  nextStepText: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: 'var(--text)',
  },
  nextStepMatch: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  waitOnly: {
    margin: 0,
    padding: '0.45rem 0.55rem',
    borderRadius: 8,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '0.82rem',
  },
  detailTitle: {
    margin: 0,
    fontWeight: 800,
    fontSize: '0.95rem',
    fontFamily: 'var(--font-display)',
    lineHeight: 1.25,
  },
  detailMoney: {
    margin: 0,
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.75rem',
    lineHeight: 1.3,
  },
  timeLine: { margin: '0.2rem 0 0', color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem' },
  historyCard: {
    marginTop: '0.35rem',
    padding: '0.4rem 0.55rem',
    borderRadius: 10,
    border: '2px solid #111',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.15rem',
  },
  tripCollapsedHint: {
    margin: '0.25rem 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 650,
  },
  tripHead: {
    margin: 0,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.2rem',
    fontSize: '0.8rem',
  },
  tripBill: {
    fontWeight: 800,
    color: 'var(--text)',
    fontFamily: 'var(--font-display)',
  },
  tripMeta: {
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  deliveredBanner: {
    margin: '0.25rem 0 0',
    padding: '0.35rem 0.55rem',
    borderRadius: 8,
    background: 'rgba(129, 199, 132, 0.18)',
    border: '1px solid rgba(129, 199, 132, 0.55)',
    color: 'var(--success)',
    fontWeight: 800,
    fontSize: '0.78rem',
  },
  cancelledBanner: {
    margin: '0.25rem 0 0',
    padding: '0.35rem 0.55rem',
    borderRadius: 8,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 800,
    fontSize: '0.78rem',
  },
  emptyBox: {
    margin: 0,
    padding: '0.75rem',
    borderRadius: 10,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  card: {
    border: '2px dotted #111',
    borderRadius: 10,
    padding: '0.4rem 0.5rem',
    marginTop: '0.3rem',
    display: 'grid',
    gap: '0.2rem',
  },
  cardWaiting: {
    borderColor: '#111',
    background: 'rgba(229, 115, 115, 0.08)',
  },
  cardReady: {
    borderColor: '#111',
    background: 'rgba(129, 199, 132, 0.12)',
  },
  cardAtHub: {
    borderColor: '#111',
    background: 'rgba(129, 199, 132, 0.05)',
  },
  cardRejected: {
    borderColor: '#111',
    background: 'var(--bg-muted)',
    opacity: 0.85,
  },
  cardInProgress: {
    borderColor: '#111',
    background: 'rgba(255, 183, 77, 0.08)',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  shopName: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.88rem',
    color: 'var(--text)',
    flex: '1 1 auto',
    minWidth: 0,
    lineHeight: 1.25,
  },
  tripBlock: {
    marginTop: '0.05rem',
    paddingTop: '0.25rem',
    borderTop: '1px dashed var(--border)',
    display: 'grid',
    gap: '0.1rem',
  },
  cardTitle: { margin: '0.2rem 0 0', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem' },
  badgeWaiting: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--danger)',
    whiteSpace: 'nowrap',
    justifySelf: 'end',
  },
  badgePartial: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--warning)',
    whiteSpace: 'nowrap',
    justifySelf: 'end',
  },
  badgeReady: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--success)',
    whiteSpace: 'nowrap',
    justifySelf: 'end',
  },
  statusWaiting: { margin: 0, color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 700 },
  statusReady: { margin: 0, color: 'var(--success)', fontSize: '0.82rem', fontWeight: 700 },
  statusInProgress: { margin: 0, color: 'var(--warning)', fontSize: '0.82rem', fontWeight: 700 },
  statusPill: {
    margin: 0,
    display: 'inline-block',
    padding: '0.1rem 0.4rem',
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 800,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  statusPillActive: {
    margin: 0,
    display: 'inline-block',
    padding: '0.1rem 0.4rem',
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 800,
    background: 'rgba(16, 185, 129, 0.18)',
    color: '#047857',
    flexShrink: 0,
  },
  statusPillGoing: {
    margin: 0,
    display: 'inline-block',
    padding: '0.1rem 0.4rem',
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 800,
    background: 'rgba(255, 152, 0, 0.2)',
    color: '#e65100',
    flexShrink: 0,
  },
  statusPillDone: {
    margin: 0,
    display: 'inline-block',
    padding: '0.1rem 0.4rem',
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 800,
    background: 'rgba(16, 185, 129, 0.14)',
    color: '#047857',
    flexShrink: 0,
  },
  statusPillRejected: {
    margin: 0,
    display: 'inline-block',
    padding: '0.1rem 0.4rem',
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 800,
    background: 'rgba(229, 115, 115, 0.18)',
    color: '#c62828',
    flexShrink: 0,
  },
  pickupReady: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.75rem',
    flex: '1 1 7rem',
    minHeight: 'var(--touch-min)',
    background: '#10B981',
    color: '#0f1a10',
    fontWeight: 800,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  alertVendorBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.75rem',
    flex: '1 1 7rem',
    minHeight: 'var(--touch-min)',
    background: '#7c3aed',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  alertWaiting: {
    flex: '1 1 8rem',
    minHeight: 'var(--touch-min)',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.78rem',
    fontWeight: 800,
    color: '#7c3aed',
  },
  alertNoticed: {
    flex: '1 1 8rem',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  meta: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 600,
    lineHeight: 1.35,
    wordBreak: 'break-word',
  },
  itemsToggle: {
    margin: 0,
    padding: '0.35rem 0',
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.84rem',
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: 36,
  },
  itemsToggleInline: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.72rem',
    cursor: 'pointer',
    display: 'inline',
  },
  itemList: {
    listStyle: 'none',
    margin: 0,
    padding: '0.3rem 0.45rem',
    display: 'grid',
    gap: '0.2rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    alignItems: 'baseline',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  itemAmt: { color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' },
  boyLine: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.74rem',
    fontWeight: 800,
  },
  changeBoyBtn: {
    border: '1.5px solid var(--border)',
    borderRadius: 10,
    padding: '0.5rem 0.7rem',
    minHeight: 'var(--touch-min)',
    width: '100%',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  changeBoyBtnInline: {
    border: '1.5px solid var(--border)',
    borderRadius: 10,
    padding: '0.5rem 0.65rem',
    minHeight: 'var(--touch-min)',
    flex: '0 0 auto',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontWeight: 800,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  rowActions: {
    display: 'flex',
    gap: '0.35rem',
    marginTop: '0.1rem',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700 },
  notice: { margin: 0, color: 'var(--success)', fontWeight: 700 },
  muted: { color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' },
  historyToggle: {
    margin: '0.55rem 0 0.25rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
  },
};
