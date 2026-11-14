import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  actOnDiagnosticsOrder,
  diagnosticsOwnerSessionFallback,
  fetchDiagnosticsSession,
  fetchMyDiagnostics,
  fetchMyVisitsHistoryCount,
  fetchVendorDiagnosticsOrders,
  resolveDiagnosticsWrites,
  uploadDiagnosticsSamplePhoto,
  type DiagnosticsPortalProfile,
  type DiagnosticsStaffRow,
  type DiagnosticsStaffSession,
  type DiagnosticsVendorOrder,
} from '../api/diagnosticsApi';
import { filterOrdersAssignedToStaff, splitMyVisitOrders, type MyVisitsPane } from '../lib/diagnosticsMyVisits';
import { DiagnosticsDispatchOrderCards } from './DiagnosticsDispatchOrderCards';
import { DiagnosticsMyVisitsHistoryPanel } from './DiagnosticsMyVisitsHistoryPanel';
import { DiagnosticsMyVisitsTabs } from './DiagnosticsMyVisitsTabs';
import { DiagnosticsVisitActions } from './DiagnosticsVisitActions';

/** Field collector home — same actions as Diagnostics → My visits. */
export function DiagnosticsMyVisitsSection({
  active = true,
  reloadToken = 0,
}: {
  active?: boolean;
  reloadToken?: number;
}) {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [staffSession, setStaffSession] = useState<DiagnosticsStaffSession | null>(null);
  const [labStaff, setLabStaff] = useState<DiagnosticsStaffRow[]>([]);
  const [billingProfile, setBillingProfile] = useState<DiagnosticsPortalProfile | null>(null);
  const [orders, setOrders] = useState<DiagnosticsVendorOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [pane, setPane] = useState<MyVisitsPane>('collect');
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (reloadToken > 0) reload();
  }, [reloadToken, reload]);

  useEffect(() => {
    setExpandedVisitId(null);
  }, [pane]);

  useEffect(() => {
    if (!active || !token) return;
    let cancelled = false;
    void Promise.all([
      fetchDiagnosticsSession(token).catch(() => null),
      fetchMyDiagnostics(token),
      fetchVendorDiagnosticsOrders(token),
    ])
      .then(([sess, me, orderRows]) => {
        if (cancelled) return;
        setStaffSession(sess ?? me?.session ?? diagnosticsOwnerSessionFallback());
        setLabStaff(Array.isArray(me?.staff) ? me.staff : []);
        setBillingProfile(me ?? null);
        setOrders(orderRows ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load visits');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, tick, active]);

  const writes = useMemo(() => resolveDiagnosticsWrites(staffSession), [staffSession]);
  const myStaffId = staffSession?.staffId ?? null;
  const { toCollect, handedOver } = useMemo(() => {
    const assigned = filterOrdersAssignedToStaff(orders, myStaffId);
    return splitMyVisitOrders(assigned);
  }, [orders, myStaffId]);

  useEffect(() => {
    if (!token || !writes.canCollection) return;
    void fetchMyVisitsHistoryCount(token)
      .then(setHistoryCount)
      .catch(() => setHistoryCount(0));
  }, [token, tick, writes.canCollection]);

  const openCount = toCollect.length;
  const activeOrders = pane === 'collect' ? toCollect : handedOver;

  async function runAction(orderId: string, action: string, extra?: Record<string, unknown>) {
    if (!token) return false;
    try {
      const updated = await actOnDiagnosticsOrder(token, orderId, { action, ...extra });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      if (action === 'START_COLLECTION') {
        setExpandedVisitId(orderId);
      }
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Action failed');
      return false;
    }
  }

  async function onSamplePhotos(orderId: string, files: File[]) {
    if (!token) return;
    try {
      for (const file of files) {
        const mediaId = await uploadDiagnosticsSamplePhoto(token, file);
        const ok = await runAction(orderId, 'ADD_SAMPLE_PHOTO', { mediaId });
        if (ok === false) break;
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Upload failed');
    }
  }

  if (!writes.canCollection) return null;

  return (
    <section style={styles.card}>
      <div style={styles.headRow}>
        <h2 style={styles.h2}>My visits</h2>
        <span style={styles.count}>{openCount} to collect</span>
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
      <DiagnosticsMyVisitsTabs
        pane={pane}
        onPaneChange={setPane}
        toCollectCount={toCollect.length}
        handedCount={handedOver.length}
        historyCount={historyCount}
      >
        {pane === 'history' ? (
          <DiagnosticsMyVisitsHistoryPanel
            token={token}
            active={active && pane === 'history'}
            reloadToken={tick + reloadToken}
            selfStaffId={myStaffId}
            selfDisplayName={staffSession?.displayName}
            expandedVisitId={expandedVisitId}
            onExpandedVisitIdChange={setExpandedVisitId}
            idPrefix="home-history"
          />
        ) : activeOrders.length === 0 ? (
          <p style={styles.empty}>
            {pane === 'collect'
              ? 'No visits waiting for collection.'
              : 'No bags handed over to the lab yet.'}
          </p>
        ) : (
          <DiagnosticsDispatchOrderCards
            orders={activeOrders}
            billing={billingProfile}
            canDispatch={false}
            singleExpanded
            expandedOrderId={expandedVisitId}
            onExpandedOrderIdChange={setExpandedVisitId}
            idPrefix={pane === 'collect' ? 'home-visit' : 'home-handed'}
            selfStaffId={myStaffId}
            selfDisplayName={staffSession?.displayName}
            onRemovePhoto={(id, mediaId) => runAction(id, 'REMOVE_SAMPLE_PHOTO', { mediaId })}
            renderFooter={
              pane === 'collect'
                ? (order) => (
                    <DiagnosticsVisitActions
                      order={order}
                      staff={labStaff}
                      onAction={runAction}
                      onPhotos={(id, files) => void onSamplePhotos(id, files)}
                    />
                  )
                : undefined
            }
          />
        )}
      </DiagnosticsMyVisitsTabs>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    borderRadius: 'var(--radius-lg)',
    padding: '0.55rem 0.65rem 0.6rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
    minWidth: 0,
  },
  headRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.45rem',
    marginBottom: '0.4rem',
  },
  h2: { margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' },
  count: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    background: 'var(--bg-muted)',
    padding: '0.15rem 0.4rem',
    borderRadius: 999,
  },
  error: { color: 'var(--danger)', fontWeight: 700, margin: '0 0 0.4rem', fontSize: '0.78rem' },
  empty: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' },
};
