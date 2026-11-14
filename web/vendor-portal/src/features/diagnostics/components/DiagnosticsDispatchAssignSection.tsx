import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import {
  actOnDiagnosticsOrder,
  diagnosticsOwnerSessionFallback,
  fetchDiagnosticsSession,
  fetchMyDiagnostics,
  fetchVendorDiagnosticsOrders,
  isDiagnosticsFinalReportsQueueOrder,
  isDiagnosticsInterimReportsQueueOrder,
  isDiagnosticsLabBenchQueueOrder,
  isVendorVisibleDiagnosticsBooking,
  resolveDiagnosticsWrites,
  type DiagnosticsPortalProfile,
  type DiagnosticsStaffSession,
  type DiagnosticsVendorOrder,
} from '../api/diagnosticsApi';
import { DiagnosticsDispatchOrderCards } from './DiagnosticsDispatchOrderCards';
import { DiagnosticsHomeSummary } from './DiagnosticsHomeSummary';
import { DiagnosticsLabActions } from './DiagnosticsLabActions';
type SellerHomePane = 'dispatch' | 'lab' | 'interim' | 'final';

const LAB_PANE_META: Record<
  Exclude<SellerHomePane, 'dispatch'>,
  { title: string; hint: string; icon: string; emptyTitle: string; emptyHint: string }
> = {
  lab: {
    title: 'Lab desk',
    hint: 'Receive bags, set report ETA, and upload reports.',
    icon: '🧪',
    emptyTitle: 'No bags on the bench',
    emptyHint: 'Handed-off samples will show here for ETA and reports.',
  },
  interim: {
    title: 'Interim report',
    hint: 'Bookings with an interim file already shared with the patient.',
    icon: '📄',
    emptyTitle: 'No interim reports out',
    emptyHint: 'Upload an interim file from Lab desk to track it here.',
  },
  final: {
    title: 'Final reports',
    hint: 'Finalized reports and completed visits.',
    icon: '✅',
    emptyTitle: 'No finalized reports yet',
    emptyHint: 'Orders move here after you finalize on the bench.',
  },
};

/** Dispatch + lab bench live on Seller home (not the Diagnostics tabs). */
export function DiagnosticsDispatchAssignSection({
  active = true,
  reloadToken = 0,
}: {
  active?: boolean;
  /** Increment (e.g. from global refresh) to refetch orders. */
  reloadToken?: number;
}) {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [profile, setProfile] = useState<DiagnosticsPortalProfile | null>(null);
  const [staffSession, setStaffSession] = useState<DiagnosticsStaffSession | null>(null);
  const [orders, setOrders] = useState<DiagnosticsVendorOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [pane, setPane] = useState<SellerHomePane>('dispatch');
  const [expandedLabOrderId, setExpandedLabOrderId] = useState<string | null>(null);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (reloadToken > 0) reload();
  }, [reloadToken, reload]);

  useEffect(() => {
    if (!active || !token) return;
    let cancelled = false;
    void Promise.all([
      fetchMyDiagnostics(token),
      fetchDiagnosticsSession(token).catch(() => null),
      fetchVendorDiagnosticsOrders(token),
    ])
      .then(([me, sess, orderRows]) => {
        if (cancelled) return;
        const effectiveSession = sess ?? me.session ?? diagnosticsOwnerSessionFallback();
        setProfile(me);
        setStaffSession(effectiveSession);
        setOrders(orderRows ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load bookings');
      });
    return () => {
      cancelled = true;
    };
  }, [token, tick, active]);

  const writes = useMemo(
    () => resolveDiagnosticsWrites(staffSession ?? profile?.session),
    [staffSession, profile?.session],
  );

  const dispatchOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          isVendorVisibleDiagnosticsBooking(o)
          && /AWAITING_PAYMENT|BOOKED|ASSIGNED|COLLECTION_IN_PROGRESS|REACHED_PATIENT|PATIENT_CONFIRMED|SAMPLES_COLLECTED/i.test(
            o.status,
          )
          && !/CANCEL|COMPLET/i.test(o.status),
      ),
    [orders],
  );

  const labBenchOrders = useMemo(() => orders.filter(isDiagnosticsLabBenchQueueOrder), [orders]);
  const interimReportOrders = useMemo(() => orders.filter(isDiagnosticsInterimReportsQueueOrder), [orders]);
  const finalReportOrders = useMemo(() => orders.filter(isDiagnosticsFinalReportsQueueOrder), [orders]);

  const pendingCount = useMemo(
    () => dispatchOrders.filter((o) => (o.allowedActions ?? []).includes('ASSIGN')).length,
    [dispatchOrders],
  );

  useEffect(() => {
    if (pane === 'dispatch' && !writes.canDispatch && writes.canLabDesk) setPane('lab');
    if (pane !== 'dispatch' && !writes.canLabDesk && writes.canDispatch) setPane('dispatch');
  }, [pane, writes.canDispatch, writes.canLabDesk]);

  const activeLabOrders =
    pane === 'interim' ? interimReportOrders : pane === 'final' ? finalReportOrders : labBenchOrders;
  const labMeta = pane === 'dispatch' ? null : LAB_PANE_META[pane];

  async function runAction(orderId: string, action: string, extra?: Record<string, unknown>) {
    if (!token) return false;
    try {
      const updated = await actOnDiagnosticsOrder(token, orderId, { action, ...extra });
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Action failed');
      return false;
    }
  }

  if (!writes.canDispatch && !writes.canLabDesk) {
    return <DiagnosticsHomeSummary readOnly />;
  }

  const showDispatch = writes.canDispatch && pane === 'dispatch';
  const showHomeTabs = (writes.canDispatch && writes.canLabDesk) || writes.canLabDesk;

  return (
    <section style={styles.card}>
      <div style={styles.cardAccentBar} aria-hidden />
      <div style={styles.headRow}>
        <div style={styles.titleCluster}>
          <span style={styles.iconTile} aria-hidden>
            {showDispatch ? '🛵' : (labMeta?.icon ?? '🧪')}
          </span>
          <div style={styles.titleTextBlock}>
            <h2 style={styles.h2}>{showDispatch ? 'Dispatch' : (labMeta?.title ?? 'Lab desk')}</h2>
            <p style={styles.hint}>
              {showDispatch
                ? 'Assign a collection agent for booked home collections. Lab hand-off is separate (manager or technician).'
                : (labMeta?.hint ?? LAB_PANE_META.lab.hint)}
            </p>
          </div>
        </div>
        <div style={styles.headActions}>
          {showHomeTabs ? (
            <div style={styles.paneSwitch} role="tablist" aria-label="Home lab work">
              {writes.canDispatch ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={pane === 'dispatch'}
                  style={pane === 'dispatch' ? styles.paneOn : styles.paneOff}
                  onClick={() => setPane('dispatch')}
                >
                  Dispatch{pendingCount > 0 ? ` (${pendingCount})` : ''}
                </button>
              ) : null}
              {writes.canLabDesk ? (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pane === 'lab'}
                    style={pane === 'lab' ? styles.paneOn : styles.paneOff}
                    onClick={() => setPane('lab')}
                  >
                    Lab desk{labBenchOrders.length > 0 ? ` (${labBenchOrders.length})` : ''}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pane === 'interim'}
                    style={pane === 'interim' ? styles.paneOn : styles.paneOff}
                    onClick={() => setPane('interim')}
                  >
                    Interim{interimReportOrders.length > 0 ? ` (${interimReportOrders.length})` : ''}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pane === 'final'}
                    style={pane === 'final' ? styles.paneOn : styles.paneOff}
                    onClick={() => setPane('final')}
                  >
                    Final{finalReportOrders.length > 0 ? ` (${finalReportOrders.length})` : ''}
                  </button>
                </>
              ) : null}
            </div>
          ) : pendingCount > 0 ? (
            <span style={styles.queueBadge} title={`${pendingCount} booking(s) to assign`}>
              {pendingCount} pending
            </span>
          ) : null}
          <Link to="/diagnostics" style={styles.linkDiagnostics}>
            Tests & staff →
          </Link>
        </div>
      </div>
      {error ? <p style={styles.error}>{error}</p> : null}
      {showDispatch ? (
        dispatchOrders.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyEmoji} aria-hidden>
              ✓
            </span>
            <p style={styles.emptyTitle}>You&apos;re caught up</p>
            <p style={styles.emptyHint}>New home collection bookings will show up here.</p>
          </div>
        ) : (
          <DiagnosticsDispatchOrderCards
            orders={dispatchOrders}
            staff={profile?.staff ?? []}
            billing={profile}
            canDispatch={writes.canDispatch}
            idPrefix="seller-home-dispatch"
            onAssign={(orderId, assignedStaffId, assignedStaffName) =>
              void runAction(orderId, 'ASSIGN', { assignedStaffId, assignedStaffName })
            }
            onRemovePhoto={(id, mediaId) => runAction(id, 'REMOVE_SAMPLE_PHOTO', { mediaId })}
          />
        )
      ) : activeLabOrders.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyEmoji} aria-hidden>
            ✓
          </span>
          <p style={styles.emptyTitle}>{labMeta?.emptyTitle ?? LAB_PANE_META.lab.emptyTitle}</p>
          <p style={styles.emptyHint}>{labMeta?.emptyHint ?? LAB_PANE_META.lab.emptyHint}</p>
        </div>
      ) : (
        <DiagnosticsDispatchOrderCards
          orders={activeLabOrders}
          staff={profile?.staff ?? []}
          billing={profile}
          canDispatch={false}
          idPrefix={`seller-home-${pane}`}
          singleExpanded
          expandedOrderId={expandedLabOrderId}
          onExpandedOrderIdChange={setExpandedLabOrderId}
          onRemovePhoto={(id, mediaId) => runAction(id, 'REMOVE_SAMPLE_PHOTO', { mediaId })}
          renderFooter={(order, { allSamplePhotosViewed }) => (
            <DiagnosticsLabActions
              order={order}
              onAction={runAction}
              staff={profile?.staff ?? []}
              token={token}
              allSamplePhotosViewed={allSamplePhotosViewed}
            />
          )}
        />
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 'var(--radius-lg)',
    padding: '0.55rem 0.65rem 0.6rem',
    background: 'linear-gradient(145deg, color-mix(in srgb, var(--accent-soft) 55%, #fff) 0%, #fff 38%, #fff 100%)',
    border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))',
    boxShadow: 'var(--shadow-card)',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  cardAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    background: 'linear-gradient(180deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 55%, var(--success)) 100%)',
    borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
  },
  headRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.45rem',
    flexWrap: 'wrap',
    marginBottom: '0.35rem',
    paddingLeft: 2,
  },
  titleCluster: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.45rem',
    minWidth: 0,
  },
  iconTile: {
    flexShrink: 0,
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.05rem',
    borderRadius: 'var(--radius-md)',
    background: 'color-mix(in srgb, var(--accent-soft) 80%, #fff)',
    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
    lineHeight: 1,
  },
  titleTextBlock: { minWidth: 0 },
  h2: { margin: 0, fontSize: '0.98rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' },
  hint: { margin: '0.12rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35, maxWidth: 520 },
  headActions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem',
  },
  paneSwitch: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.2rem',
    padding: 2,
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--bg-muted) 70%, #fff)',
    border: '1px solid var(--border)',
    maxWidth: 'min(100%, 22rem)',
  },
  paneOn: {
    border: 'none',
    borderRadius: 999,
    minHeight: 32,
    padding: '0.2rem 0.55rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #064e3b, #0f766e)',
    color: '#ecfdf5',
  },
  paneOff: {
    border: 'none',
    borderRadius: 999,
    minHeight: 32,
    padding: '0.2rem 0.55rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--text)',
  },
  queueBadge: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    padding: '0.2rem 0.45rem',
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--warning-soft) 90%, #fff)',
    color: 'color-mix(in srgb, var(--warning) 85%, #000)',
    border: '1px solid color-mix(in srgb, var(--warning) 28%, var(--border))',
  },
  linkDiagnostics: {
    fontSize: '0.72rem',
    fontWeight: 750,
    color: 'var(--accent)',
    textDecoration: 'none',
    padding: '0.28rem 0.5rem',
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
    background: 'color-mix(in srgb, #fff 82%, var(--accent-soft))',
  },
  error: { color: 'var(--danger)', fontWeight: 700, margin: '0 0 0.5rem', paddingLeft: 2 },
  emptyState: {
    textAlign: 'center',
    padding: '0.55rem 0.35rem 0.25rem',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed color-mix(in srgb, var(--border) 80%, var(--accent))',
    background: 'color-mix(in srgb, var(--bg-muted) 50%, #fff)',
  },
  emptyEmoji: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 32,
    height: 32,
    marginBottom: '0.25rem',
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--success-soft) 90%, #fff)',
    color: 'var(--success)',
    fontWeight: 900,
    fontSize: '0.9rem',
  },
  emptyTitle: { margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)' },
  emptyHint: { margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 },
};
