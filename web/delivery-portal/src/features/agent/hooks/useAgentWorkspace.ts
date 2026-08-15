import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  deliverOrder,
  fetchMyAssignments,
  fetchMyStats,
  pickFromHub,
  pickFromVendor,
  toAssignmentView,
  type AgentStatsView,
  type AssignmentView,
} from '../api/agentApi';
import { summarizeActiveWork } from '../lib/assignmentSteps';

export type AgentLeg = 'PICKUP' | 'LAST_MILE';
export type AgentScope = 'active' | 'completed';

const PAGE_SIZE = 15;
const ACTIVE_FETCH_SIZE = 100;

type Options = {
  scope?: AgentScope;
  leg?: AgentLeg;
  page?: number;
  pageSize?: number;
};

function filterByLeg(list: AssignmentView[], leg?: AgentLeg): AssignmentView[] {
  if (!leg) return list;
  return list.filter((a) => a.legType === leg);
}

function filterBySearch(list: AssignmentView[], search: string): AssignmentView[] {
  const q = search.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (a) =>
      a.orderNumber.toLowerCase().includes(q) ||
      a.assignmentNumber.toLowerCase().includes(q) ||
      (a.subOrderNumber?.toLowerCase().includes(q) ?? false),
  );
}

export function useAgentWorkspace(options: Options = {}) {
  const scope = options.scope ?? 'active';
  const leg = options.leg;
  const page = options.page ?? 0;
  const pageSize = options.pageSize ?? (scope === 'active' ? ACTIVE_FETCH_SIZE : PAGE_SIZE);

  const { session } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentView[]>([]);
  const [search, setSearch] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [stats, setStats] = useState<AgentStatsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [list, agentStats] = await Promise.all([
        fetchMyAssignments(session.accessToken, { scope, page, size: pageSize }),
        fetchMyStats(session.accessToken),
      ]);
      setAssignments((list.items ?? []).map(toAssignmentView));
      setTotalPages(list.totalPages ?? 0);
      setTotalElements(list.totalElements ?? 0);
      setStats(agentStats);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [session, scope, page, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const legAssignments = useMemo(() => filterByLeg(assignments, leg), [assignments, leg]);
  const visibleAssignments = useMemo(
    () => filterBySearch(legAssignments, search),
    [legAssignments, search],
  );

  const workSummary = useMemo(() => summarizeActiveWork(assignments), [assignments]);

  const pickupTasks = useMemo(
    () => filterBySearch(filterByLeg(assignments, 'PICKUP'), search),
    [assignments, search],
  );

  const deliveryTasks = useMemo(
    () => filterBySearch(filterByLeg(assignments, 'LAST_MILE'), search),
    [assignments, search],
  );

  async function doPickVendor(id: string, status: string) {
    if (!session || status !== 'ASSIGNED') return;
    setActionId(id);
    setError(null);
    setNotice(null);
    try {
      await pickFromVendor(session.accessToken, id, 'Verified qty');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm pickup');
    } finally {
      setActionId(null);
    }
  }

  async function doPickHub(id: string, status: string) {
    if (!session || status !== 'ASSIGNED') return;
    setActionId(id);
    setError(null);
    setNotice(null);
    try {
      await pickFromHub(session.accessToken, id);
      setNotice('Order taken from hub. Go to customer home.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not take order from hub');
    } finally {
      setActionId(null);
    }
  }

  async function doDeliver(id: string, status: string, otp: string, recipientName = 'Customer') {
    if (!session || status !== 'IN_PROGRESS') return;
    const code = otp.trim();
    if (!code) {
      setError('Type the phone code first');
      return;
    }
    setActionId(id);
    setError(null);
    setNotice(null);
    try {
      await deliverOrder(session.accessToken, id, code, recipientName.trim() || 'Customer');
      setNotice('Delivery done. Good job!');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish delivery');
    } finally {
      setActionId(null);
    }
  }

  return {
    scope,
    leg,
    search,
    page,
    pageSize,
    totalPages,
    totalElements,
    assignments: visibleAssignments,
    pickupTasks,
    deliveryTasks,
    workSummary,
    stats,
    loading,
    actionId,
    error,
    notice,
    reload,
    setSearch,
    doPickVendor,
    doPickHub,
    doDeliver,
  };
}
