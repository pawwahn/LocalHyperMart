import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  assignLastMile,
  assignPickup,
  alertVendor,
  fetchAdminOrderDetail,
  fetchAdminOrders,
  fetchHubAgents,
  fetchHubDashboard,
  fetchMyHub,
  markSubOrderAtHub,
  reassignAssignment,
  toOrderRow,
  type AdminOrderDetailDto,
  type AgentDto,
  type HubDashboardView,
  type OrderRowView,
  type SubOrderRowView,
} from '../api/hubApi';

export type HubOrderTab = 'action' | 'vendor-wait' | 'all';

const PAGE_SIZE = 15;
const LAST_AGENT_KEY = 'hlm.hub.lastAgentId';

function money(v: number | null | undefined): string {
  return `₹${Number(v ?? 0).toFixed(2)}`;
}

function filterHubOrders(orders: OrderRowView[], tab: HubOrderTab, search: string): OrderRowView[] {
  let list = orders;
  if (tab === 'action') {
    // Needs hub action: shops ready for pickup, or all bags at hub awaiting home delivery.
    list = list.filter(
      (o) =>
        o.status === 'PLACED' &&
        (o.readySubOrderCount > 0 ||
          o.pickupReadiness === 'partial' ||
          (o.subOrderCount > 0 && o.atHubSubOrderCount >= o.subOrderCount)),
    );
  } else if (tab === 'vendor-wait') {
    // Still packing — nothing ready and nothing at hub yet.
    list = list.filter(
      (o) =>
        o.status === 'PLACED' &&
        o.readySubOrderCount === 0 &&
        o.atHubSubOrderCount === 0,
    );
  }
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((o) => o.orderNumber.toLowerCase().includes(q));
  }
  return list;
}

function readLastAgentId(): string | null {
  try {
    return sessionStorage.getItem(LAST_AGENT_KEY);
  } catch {
    return null;
  }
}

function writeLastAgentId(agentId: string) {
  try {
    sessionStorage.setItem(LAST_AGENT_KEY, agentId);
  } catch {
    // ignore
  }
}

export function useHubWorkspace() {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<HubDashboardView | null>(null);
  const [orders, setOrders] = useState<OrderRowView[]>([]);
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [orderTab, setOrderTab] = useState<HubOrderTab>('action');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetailDto | null>(null);
  const [subOrders, setSubOrders] = useState<SubOrderRowView[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastAgentId, setLastAgentId] = useState<string | null>(() => readLastAgentId());

  const hubId = session?.hubId;
  const townId = session?.townId;

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) map.set(a.agentId, a.name);
    return map;
  }, [agents]);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const me = await fetchMyHub(session.accessToken);
      const resolvedHubId = me.hubId || hubId;
      const resolvedTownId = me.townId || townId;
      const [dash, list, agentList] = await Promise.all([
        fetchHubDashboard(session.accessToken, resolvedHubId),
        fetchAdminOrders(session.accessToken, resolvedTownId, {
          page,
          size: PAGE_SIZE,
          status: 'PLACED',
        }),
        fetchHubAgents(session.accessToken, resolvedHubId).catch(() => [] as AgentDto[]),
      ]);
      setDashboard(dash);
      setOrders((list.items ?? []).map(toOrderRow));
      setTotalPages(list.totalPages ?? 0);
      setTotalElements(list.totalElements ?? 0);
      setAgents(agentList);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load hub');
    } finally {
      setLoading(false);
    }
  }, [session, hubId, townId, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleOrders = useMemo(
    () => filterHubOrders(orders, orderTab, search),
    [orders, orderTab, search],
  );

  const tabCounts = useMemo(
    () => ({
      action: filterHubOrders(orders, 'action', '').length,
      vendorWait: filterHubOrders(orders, 'vendor-wait', '').length,
      all: totalElements,
    }),
    [orders, totalElements],
  );

  function changeTab(tab: HubOrderTab) {
    setOrderTab(tab);
    setPage(0);
    setSelectedOrderId(null);
    setDetail(null);
  }

  function clearOrderSelection() {
    setSelectedOrderId(null);
    setDetail(null);
    setSubOrders([]);
    setShowHistory(true);
  }

  function rememberAgent(agentId: string) {
    setLastAgentId(agentId);
    writeLastAgentId(agentId);
  }

  function agentLabel(agentId?: string | null): string {
    if (!agentId) return 'Agent';
    return agentNameById.get(agentId) ?? 'Agent';
  }

  async function openOrder(orderId: string) {
    if (!session) return;
    setSelectedOrderId(orderId);
    setShowHistory(true);
    setError(null);
    try {
      const d = await fetchAdminOrderDetail(session.accessToken, townId, orderId);
      setDetail(d);
      const assignments = (d.assignments ?? []).map((a) => ({
        legType: a.legType,
        status: a.status,
        subOrderNumber: a.subOrderNumber,
      }));
      const allSubs = d.subOrders ?? [];
      const activeSubs = allSubs.filter((s) => s.status !== 'VENDOR_REJECTED');
      const rejected = allSubs.length - activeSubs.length;
      const atHub = activeSubs.filter(
        (s) =>
          s.status === 'DELIVERED' ||
          assignments.some(
            (a) =>
              a.legType === 'PICKUP' &&
              a.status === 'COMPLETED' &&
              a.subOrderNumber === s.subOrderNumber,
          ),
      ).length;
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const total = activeSubs.length || o.subOrderCount;
          const readyRaw = activeSubs.filter((s) => s.status === 'READY_FOR_PICKUP').length;
          const readyForShop = Math.max(0, readyRaw - Math.min(readyRaw, atHub));
          return {
            ...o,
            subOrderCount: total,
            rejectedSubOrderCount: rejected,
            atHubSubOrderCount: atHub,
            readySubOrderCount: readyForShop,
            assignments,
            pickupReadiness:
              atHub >= total && total > 0
                ? 'none'
                : readyForShop <= 0
                  ? 'none'
                  : readyForShop >= Math.max(0, total - atHub)
                    ? 'all'
                    : 'partial',
          };
        }),
      );
      setSubOrders(
        (d.subOrders ?? []).map((s) => ({
          id: s.subOrderId,
          subOrderNumber: s.subOrderNumber,
          shopName: (s.shopName && s.shopName.trim()) || 'Shop',
          status: s.status,
          subtotalLabel: money(s.subtotal),
          itemCount: s.itemCount,
          vendorId: s.vendorId,
          items: (s.items ?? []).map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitCode: item.unitCode || undefined,
            lineTotalLabel:
              item.lineTotal != null ? money(item.lineTotal) : undefined,
          })),
          vendorAlert: s.vendorAlert
            ? {
                alertId: s.vendorAlert.alertId,
                status: s.vendorAlert.status,
                createdAt: s.vendorAlert.createdAt,
                acknowledgedAt: s.vendorAlert.acknowledgedAt,
              }
            : null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order');
    }
  }

  async function doAssignPickup(subOrderId: string, agentId: string): Promise<boolean> {
    if (!session) return false;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await assignPickup(session.accessToken, subOrderId, agentId);
      rememberAgent(agentId);
      setNotice(`Shop pickup assigned to ${agentLabel(agentId)}.`);
      if (selectedOrderId) await openOrder(selectedOrderId);
      await reload();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pickup assign failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function doMarkAtHub(subOrderId: string) {
    if (!session) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await markSubOrderAtHub(session.accessToken, subOrderId);
      setNotice('Marked as received at hub.');
      if (selectedOrderId) await openOrder(selectedOrderId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'At-hub failed');
    } finally {
      setBusy(false);
    }
  }

  async function doAssignLastMile(orderId: string, agentId: string): Promise<boolean> {
    if (!session) return false;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await assignLastMile(session.accessToken, orderId, agentId);
      rememberAgent(agentId);
      setNotice(`Home delivery assigned to ${agentLabel(agentId)}.`);
      if (selectedOrderId) await openOrder(selectedOrderId);
      await reload();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Last-mile assign failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function doReassign(assignmentId: string, newAgentId: string): Promise<boolean> {
    if (!session) return false;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await reassignAssignment(session.accessToken, assignmentId, newAgentId);
      rememberAgent(newAgentId);
      setNotice(`Trip moved to ${agentLabel(newAgentId)}.`);
      if (selectedOrderId) await openOrder(selectedOrderId);
      await reload();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change delivery agent');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function doAlertVendor(subOrderId: string): Promise<boolean> {
    if (!session || !townId) return false;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await alertVendor(session.accessToken, townId, subOrderId);
      setNotice('Reminder sent — vendor popup + sound until they tap Noticed order.');
      if (selectedOrderId) await openOrder(selectedOrderId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not alert vendor');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    hubId,
    townId,
    dashboard,
    orders: visibleOrders,
    agents,
    lastAgentId,
    agentLabel,
    orderTab,
    search,
    page,
    pageSize: PAGE_SIZE,
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
  };
}
