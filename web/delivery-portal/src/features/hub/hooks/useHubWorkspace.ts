import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  orderRowFromDetail,
  toOrderRow,
  type AdminOrderDetailDto,
  type AgentDto,
  type HubDashboardView,
  type OrderRowView,
  type SubOrderRowView,
} from '../api/hubApi';
import {
  fetchCodCustodianOutstanding,
  fetchCodHubLedger,
  type CodCustodianOutstanding,
  type CodHubLedger,
} from '../api/codApi';

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
  const [pageOrders, setPageOrders] = useState<OrderRowView[]>([]);
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
  const [codOutstanding, setCodOutstanding] = useState<CodCustodianOutstanding | null>(null);
  const [codOutstandingError, setCodOutstandingError] = useState<string | null>(null);
  const [codLedger, setCodLedger] = useState<CodHubLedger | null>(null);
  const [lastAgentId, setLastAgentId] = useState<string | null>(() => readLastAgentId());
  const atHubAbortRef = useRef<AbortController | null>(null);

  const hubId = session?.hubId;
  const townId = session?.townId;

  const agentById = useMemo(() => {
    const map = new Map<string, AgentDto>();
    for (const a of agents) map.set(a.agentId, a);
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

      const dashPromise = fetchHubDashboard(session.accessToken, resolvedHubId);
      const listPromise = fetchAdminOrders(session.accessToken, resolvedTownId, {
        page,
        size: PAGE_SIZE,
        status: 'PLACED',
      });
      const agentPromise = fetchHubAgents(session.accessToken, resolvedHubId).catch(() => [] as AgentDto[]);
      const codPromise =
        resolvedTownId && resolvedHubId
          ? fetchCodCustodianOutstanding(session.accessToken, {
              townId: resolvedTownId,
              hubId: resolvedHubId,
            }).catch((err) => {
              const message =
                err instanceof ApiError
                  ? err.message
                  : err instanceof Error
                    ? err.message
                    : 'Could not load COD';
              setCodOutstandingError(message);
              return null;
            })
          : Promise.resolve(null);
      const ledgerPromise =
        resolvedTownId && resolvedHubId
          ? fetchCodHubLedger(session.accessToken, { townId: resolvedTownId, hubId: resolvedHubId }).catch(
              () => null,
            )
          : Promise.resolve(null);

      const [dashResult, listResult, agentList, cod, ledger] = await Promise.allSettled([
        dashPromise,
        listPromise,
        agentPromise,
        codPromise,
        ledgerPromise,
      ]);

      const failures: string[] = [];
      if (dashResult.status === 'fulfilled') {
        setDashboard(dashResult.value);
      } else {
        failures.push(
          dashResult.reason instanceof ApiError || dashResult.reason instanceof Error
            ? dashResult.reason.message
            : 'Dashboard stats failed',
        );
        setDashboard(null);
      }

      if (listResult.status === 'fulfilled') {
        const list = listResult.value;
        setPageOrders((list.items ?? []).map(toOrderRow));
        setTotalPages(list.totalPages ?? 0);
        setTotalElements(list.totalElements ?? 0);
      } else {
        failures.push(
          listResult.reason instanceof ApiError || listResult.reason instanceof Error
            ? listResult.reason.message
            : 'Order list failed',
        );
        setPageOrders([]);
        setTotalPages(0);
        setTotalElements(0);
      }

      setAgents(agentList.status === 'fulfilled' ? agentList.value : []);

      if (cod.status === 'fulfilled' && cod.value) {
        setCodOutstanding(cod.value);
        setCodOutstandingError(null);
      } else if (!resolvedTownId || !resolvedHubId) {
        setCodOutstanding(null);
        setCodOutstandingError(null);
      }

      setCodLedger(ledger.status === 'fulfilled' ? (ledger.value ?? null) : null);

      if (failures.length) {
        setError(failures.join(' · '));
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load hub');
    } finally {
      setLoading(false);
    }
  }, [session, hubId, townId, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const visibleOrders = useMemo(
    () => filterHubOrders(pageOrders, orderTab, search),
    [pageOrders, orderTab, search],
  );

  const selectedOrderRow = useMemo((): OrderRowView | null => {
    if (!selectedOrderId) return null;
    const fromPage = pageOrders.find((o) => o.id === selectedOrderId);
    if (fromPage) return fromPage;
    if (detail?.orderId === selectedOrderId) {
      return orderRowFromDetail(detail);
    }
    return null;
  }, [pageOrders, selectedOrderId, detail]);

  const tabCounts = useMemo(
    () => ({
      action: filterHubOrders(pageOrders, 'action', '').length,
      vendorWait: filterHubOrders(pageOrders, 'vendor-wait', '').length,
      all: totalElements,
    }),
    [pageOrders, totalElements],
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
    const agent = agentById.get(agentId);
    const fromAssignment = detail?.assignments?.find((a) => a.agentId === agentId);
    const name = agent?.name?.trim() || fromAssignment?.agentName?.trim() || 'Agent';
    const phone = agent?.phone?.trim() || fromAssignment?.agentPhone?.trim();
    return phone ? `${name} (${phone})` : name;
  }

  async function openOrder(orderId: string) {
    if (!session) return;
    if (selectedOrderId !== orderId) setNotice(null);
    setSelectedOrderId(orderId);
    setShowHistory(true);
    setError(null);
    try {
      const d = await fetchAdminOrderDetail(session.accessToken, townId, orderId);
      setDetail(d);
      const refreshed = orderRowFromDetail(d);
      setPageOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === orderId);
        if (idx < 0) return [...prev, refreshed];
        const existing = prev[idx];
        return prev.map((o) =>
          o.id === orderId
            ? {
                ...refreshed,
                paymentStatus: existing.paymentStatus,
                vendorAgentDelivery: existing.vendorAgentDelivery,
              }
            : o,
        );
      });
      setSubOrders(
        (d.subOrders ?? []).map((s) => ({
          id: s.subOrderId,
          subOrderNumber: s.subOrderNumber,
          shopName: (s.shopName && s.shopName.trim()) || 'Shop',
          status: s.status,
          subtotalLabel: money(s.subtotal),
          itemCount: s.itemCount,
          cancelledItemCount: s.cancelledItemCount ?? 0,
          vendorId: s.vendorId,
          items: (s.items ?? []).map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitCode: item.unitCode || undefined,
            lineTotalLabel:
              item.lineTotal != null ? money(item.lineTotal) : undefined,
            cancelled: (item.status ?? 'ACTIVE').toUpperCase() === 'CANCELLED',
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
      await reload();
      if (selectedOrderId) await openOrder(selectedOrderId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pickup assign failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function cancelMarkAtHub() {
    atHubAbortRef.current?.abort();
    atHubAbortRef.current = null;
  }

  async function doMarkAtHub(subOrderId: string): Promise<boolean> {
    if (!session) return false;
    cancelMarkAtHub();
    const ac = new AbortController();
    atHubAbortRef.current = ac;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await markSubOrderAtHub(session.accessToken, subOrderId, ac.signal);
      setNotice('Marked as received at hub.');
      return true;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || /not found/i.test(err.message))) {
        setNotice('Bag already marked at hub.');
        return true;
      }
      if (err instanceof ApiError && err.message === 'Cancelled') {
        return false;
      }
      setError(err instanceof Error ? err.message : 'At-hub failed');
      return false;
    } finally {
      if (atHubAbortRef.current === ac) atHubAbortRef.current = null;
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
      await reload();
      if (selectedOrderId) await openOrder(selectedOrderId);
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
      await reload();
      if (selectedOrderId) await openOrder(selectedOrderId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change delivery agent');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function doAlertVendor(subOrderId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!session || !townId) {
      return { ok: false, message: 'Session or town missing — refresh and try again.' };
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await alertVendor(session.accessToken, townId, subOrderId);
      setNotice('Reminder sent — vendor popup + sound until they tap Noticed order.');
      if (selectedOrderId) await openOrder(selectedOrderId);
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not alert vendor';
      setError(message);
      return { ok: false, message };
    } finally {
      setBusy(false);
    }
  }

  return {
    hubId,
    townId,
    codOutstanding,
    codOutstandingError,
    codLedger,
    dashboard,
    orders: visibleOrders,
    selectedOrderRow,
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
    cancelMarkAtHub,
    doAssignLastMile,
    doReassign,
    doAlertVendor,
  };
}
