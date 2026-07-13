import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/shared/auth/AuthContext';

import { ApiError } from '@/shared/api/http';

import { PILOT } from '@/features/auth/api/authApi';

import {

  assignLastMile,

  assignPickup,

  fetchAdminOrderDetail,

  fetchAdminOrders,

  fetchHubDashboard,

  fetchMyHub,

  markSubOrderAtHub,

  toOrderRow,

  type AdminOrderDetailDto,

  type HubDashboardView,

  type OrderRowView,

  type SubOrderRowView,

} from '../api/hubApi';



export type HubOrderTab = 'action' | 'vendor-wait' | 'all';



const PAGE_SIZE = 15;



function money(v: number | null | undefined): string {

  return `₹${Number(v ?? 0).toFixed(2)}`;

}



function filterHubOrders(orders: OrderRowView[], tab: HubOrderTab, search: string): OrderRowView[] {

  let list = orders;

  if (tab === 'action') {

    list = list.filter((o) => o.readySubOrderCount > 0 || o.pickupReadiness === 'partial');

  } else if (tab === 'vendor-wait') {

    list = list.filter((o) => o.status === 'PLACED' && o.readySubOrderCount === 0);

  }

  const q = search.trim().toLowerCase();

  if (q) {

    list = list.filter((o) => o.orderNumber.toLowerCase().includes(q));

  }

  return list;

}



export function useHubWorkspace() {

  const { session } = useAuth();

  const [dashboard, setDashboard] = useState<HubDashboardView | null>(null);

  const [orders, setOrders] = useState<OrderRowView[]>([]);

  const [orderTab, setOrderTab] = useState<HubOrderTab>('action');

  const [search, setSearch] = useState('');

  const [page, setPage] = useState(0);

  const [totalPages, setTotalPages] = useState(0);

  const [totalElements, setTotalElements] = useState(0);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [detail, setDetail] = useState<AdminOrderDetailDto | null>(null);

  const [subOrders, setSubOrders] = useState<SubOrderRowView[]>([]);

  const [showHistory, setShowHistory] = useState(false);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);



  const hubId = session?.hubId ?? PILOT.hubId;

  const townId = session?.townId ?? PILOT.townId;

  const agentId = PILOT.agentId;



  const reload = useCallback(async () => {

    if (!session) return;

    setLoading(true);

    setError(null);

    try {

      const me = await fetchMyHub(session.accessToken);

      const resolvedHubId = me.hubId || hubId;

      const resolvedTownId = me.townId || townId;

      const statusFilter = 'PLACED';

      const [dash, list] = await Promise.all([

        fetchHubDashboard(session.accessToken, resolvedHubId),

        fetchAdminOrders(session.accessToken, resolvedTownId, {

          page,

          size: PAGE_SIZE,

          status: statusFilter,

        }),

      ]);

      setDashboard(dash);

      setOrders((list.items ?? []).map(toOrderRow));

      setTotalPages(list.totalPages ?? 0);

      setTotalElements(list.totalElements ?? 0);

    } catch (err) {

      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load hub');

    } finally {

      setLoading(false);

    }

  }, [session, hubId, townId, orderTab, page]);



  useEffect(() => {

    void reload();

  }, [reload]);



  const visibleOrders = useMemo(

    () => filterHubOrders(orders, orderTab, search),

    [orders, orderTab, search],

  );



  // Open desk only (status=PLACED). Counts match filtered lists on the loaded page.
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
    setShowHistory(false);
  }

  async function openOrder(orderId: string) {

    if (!session) return;

    setSelectedOrderId(orderId);

    setShowHistory(false);

    setError(null);

    try {

      const d = await fetchAdminOrderDetail(session.accessToken, townId, orderId);

      setDetail(d);

      setSubOrders(

        (d.subOrders ?? []).map((s) => ({

          id: s.subOrderId,

          subOrderNumber: s.subOrderNumber,

          shopName: (s.shopName && s.shopName.trim()) || 'Shop',

          status: s.status,

          subtotalLabel: money(s.subtotal),

          itemCount: s.itemCount,

          vendorId: s.vendorId,

        })),

      );

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Could not load order');

    }

  }



  async function doAssignPickup(subOrderId: string) {

    if (!session) return;

    setBusy(true);

    setNotice(null);

    setError(null);

    try {

      await assignPickup(session.accessToken, subOrderId, agentId);

      setNotice('Vendor pickup assigned — agent will collect from shop.');

      if (selectedOrderId) await openOrder(selectedOrderId);

      await reload();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Pickup assign failed');

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



  async function doAssignLastMile(orderId: string) {

    if (!session) return;

    setBusy(true);

    setNotice(null);

    setError(null);

    try {

      await assignLastMile(session.accessToken, orderId, agentId);

      setNotice('Buyer delivery assigned. OTP is in notification_logs (dev stub).');

      if (selectedOrderId) await openOrder(selectedOrderId);

      await reload();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Last-mile assign failed');

    } finally {

      setBusy(false);

    }

  }



  return {

    hubId,

    townId,

    dashboard,

    orders: visibleOrders,

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

  };

}


