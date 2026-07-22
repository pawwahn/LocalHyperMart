import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  cancelSubOrderItem,
  fetchDashboard,
  fetchSubOrders,
  markSubOrderReady,
  rejectSubOrder,
  restoreSubOrderItem,
  type DashboardView,
  type SubOrderView,
} from '../api/ordersApi';
import { lookupOrderPayouts } from '@/features/reports/api/payoutsApi';
import { fetchSalesReport, formatMoney } from '@/features/reports/api/reportsApi';
import { useOrderAlert } from '../OrderAlertContext';

function isoToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useVendorOrders() {
  const { session } = useAuth();
  const { alertVersion } = useOrderAlert();
  const [dashboard, setDashboard] = useState<DashboardView | null>(null);
  const [orders, setOrders] = useState<SubOrderView[]>([]);
  const [statusFilter, setStatusFilter] = useState('PLACED');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moneyWaiting, setMoneyWaiting] = useState(0);
  const [moneyWaitingOrders, setMoneyWaitingOrders] = useState(0);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [dash, list] = await Promise.all([
        fetchDashboard(session.accessToken, session.vendorId),
        fetchSubOrders(session.accessToken, session.vendorId, statusFilter || undefined),
      ]);
      setDashboard(dash);
      setOrders(list);

      try {
        const openSales = await fetchSalesReport(session.accessToken, session.vendorId, {
          from: isoDaysAgo(60),
          to: isoToday(),
          includeItems: false,
        });
        const payouts = await lookupOrderPayouts(
          session.accessToken,
          session.vendorId,
          (openSales.rows ?? []).map((r) => r.subOrderId),
        );
        let waiting = 0;
        let waitingOrders = 0;
        for (const row of openSales.rows ?? []) {
          if (row.status === 'VENDOR_REJECTED' || row.status === 'REJECTED') continue;
          if (!payouts[row.subOrderId]?.paid) {
            waiting += Number(row.subtotal ?? 0);
            waitingOrders += 1;
          }
        }
        setMoneyWaiting(waiting);
        setMoneyWaitingOrders(waitingOrders);
      } catch {
        setMoneyWaiting(0);
        setMoneyWaitingOrders(0);
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [session, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // New-order poll lives in OrderAlertProvider; refresh Home list when it fires.
  useEffect(() => {
    if (alertVersion > 0) void reload();
  }, [alertVersion, reload]);

  async function markReady(id: string) {
    if (!session) return;
    setActionId(id);
    setNotice(null);
    setError(null);
    try {
      await markSubOrderReady(session.accessToken, session.vendorId, id);
      setNotice('Marked ready for pickup.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark ready');
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string, reason: string): Promise<boolean> {
    if (!session) return false;
    setActionId(id);
    setNotice(null);
    setError(null);
    try {
      await rejectSubOrder(session.accessToken, session.vendorId, id, reason);
      setNotice('Your items rejected. Buyer credited (or refunded if this was the last shop).');
      await reload();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject');
      return false;
    } finally {
      setActionId(null);
    }
  }

  async function cancelItem(
    subOrderId: string,
    itemId: string,
    reason: string,
    itemName?: string,
  ): Promise<{ ok: boolean; message: string }> {
    if (!session) {
      return { ok: false, message: 'Not signed in' };
    }
    const label = itemName?.trim() ? `“${itemName.trim()}”` : 'Item';
    setActionId(`${subOrderId}:${itemId}`);
    setNotice(null);
    setError(null);
    try {
      await cancelSubOrderItem(session.accessToken, session.vendorId, subOrderId, itemId, reason);
      const message = `${label} cancelled. Buyer store credit issued.`;
      setNotice(message);
      try {
        await reload();
      } catch {
        // Cancel already succeeded — don't keep the dialog open if list refresh fails.
      }
      return { ok: true, message };
    } catch (err) {
      const reasonText =
        err instanceof ApiError || err instanceof Error ? err.message : 'Could not cancel item';
      const message = `${label} could not be cancelled. ${reasonText}`;
      setError(message);
      return { ok: false, message };
    } finally {
      setActionId(null);
    }
  }

  async function restoreItem(
    subOrderId: string,
    itemId: string,
    itemName?: string,
  ): Promise<{ ok: boolean; message: string }> {
    if (!session) {
      return { ok: false, message: 'Not signed in' };
    }
    const label = itemName?.trim() ? `“${itemName.trim()}”` : 'Item';
    setActionId(`${subOrderId}:${itemId}:restore`);
    setNotice(null);
    setError(null);
    try {
      await restoreSubOrderItem(session.accessToken, session.vendorId, subOrderId, itemId);
      const message = `${label} restored. Buyer store credit reversed.`;
      setNotice(message);
      try {
        await reload();
      } catch {
        // Restore already succeeded — still show success to the seller.
      }
      return { ok: true, message };
    } catch (err) {
      const reason =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Could not restore item';
      const message = `${label} could not be restored. ${reason}`;
      setError(message);
      return { ok: false, message };
    } finally {
      setActionId(null);
    }
  }

  return {
    dashboard,
    orders,
    statusFilter,
    setStatusFilter,
    loading,
    actionId,
    error,
    notice,
    moneyWaitingLabel: formatMoney(moneyWaiting),
    moneyWaitingHint:
      moneyWaitingOrders > 0
        ? `${moneyWaitingOrders} orders not yet paid by admin`
        : 'No unpaid shop sales in last 60 days',
    reload,
    markReady,
    reject,
    cancelItem,
    restoreItem,
  };
}
