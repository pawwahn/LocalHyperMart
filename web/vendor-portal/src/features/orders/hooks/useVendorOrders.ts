import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  fetchDashboard,
  fetchSubOrders,
  markSubOrderReady,
  rejectSubOrder,
  type DashboardView,
  type SubOrderView,
} from '../api/ordersApi';

export function useVendorOrders() {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardView | null>(null);
  const [orders, setOrders] = useState<SubOrderView[]>([]);
  const [statusFilter, setStatusFilter] = useState('PLACED');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [session, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  async function reject(id: string, reason: string) {
    if (!session) return;
    setActionId(id);
    setNotice(null);
    setError(null);
    try {
      await rejectSubOrder(session.accessToken, session.vendorId, id, reason);
      setNotice('Order rejected.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject');
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
    reload,
    markReady,
    reject,
  };
}
