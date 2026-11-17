import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Button, Card } from '@/shared/ui';
import { ConfirmDialog } from '@/features/orders/components/ConfirmDialog';
import { beautyBookingTotal, beautyPaymentPlanView, primaryBeautyWorkflowAction } from '@hlm-beauty';
import {
  actOnBeautyOrder,
  beautyActionLabel,
  fetchVendorBeautyOrders,
  type BeautyOrder,
} from '../api/beautyApi';

type Filter = 'open' | 'done';

function rupee(value: number): string {
  return `₹${Number(value || 0).toFixed(0)}`;
}

function collectTotal(order: BeautyOrder): number {
  return beautyBookingTotal(order);
}

function formatSlot(start?: string | null, end?: string | null): string {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const day = s.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const t1 = s.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const t2 = e ? e.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
  return t2 ? `${day} · ${t1} – ${t2}` : `${day} · ${t1}`;
}

function isOpen(order: BeautyOrder): boolean {
  return order.status !== 'COMPLETED' && order.status !== 'CANCELLED';
}

function paySettlementStyle(tone: 'ok' | 'warn' | 'muted' | 'danger'): CSSProperties {
  const base: CSSProperties = { fontSize: '0.68rem', fontWeight: 800 };
  if (tone === 'ok') return { ...base, color: '#047857' };
  if (tone === 'warn') return { ...base, color: '#b45309' };
  if (tone === 'danger') return { ...base, color: '#b91c1c' };
  return { ...base, color: 'var(--text-muted)' };
}

function statusPillStyle(status: string): CSSProperties {
  const base: CSSProperties = {
    ...styles.statusPill,
  };
  const s = status.toUpperCase();
  if (s === 'COMPLETED' || s === 'DONE') {
    return { ...base, ...styles.statusDone };
  }
  if (s === 'CANCELLED' || s === 'CANCELED') {
    return { ...base, ...styles.statusCancelled };
  }
  if (s === 'IN_PROGRESS' || s === 'STARTED') {
    return { ...base, ...styles.statusLive };
  }
  if (s === 'EN_ROUTE' || s === 'ON_THE_WAY') {
    return { ...base, ...styles.statusEnRoute };
  }
  return { ...base, ...styles.statusConfirmed };
}

export function BeautyBookings({ active = true, reloadToken = 0 }: { active?: boolean; reloadToken?: number }) {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [orders, setOrders] = useState<BeautyOrder[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: string;
    orderId: string;
    warnBanner?: string;
    visitCashCollected?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (silent = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      void fetchVendorBeautyOrders(token)
        .then((rows) => {
          setOrders(Array.isArray(rows) ? rows : []);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load bookings'))
        .finally(() => setLoading(false));
    },
    [token],
  );

  useEffect(() => {
    if (!active) return;
    load(false);
    const id = window.setInterval(() => load(true), 12_000);
    return () => window.clearInterval(id);
  }, [active, load, reloadToken]);

  const shown = useMemo(() => {
    const list = filter === 'open' ? orders.filter(isOpen) : orders.filter((o) => !isOpen(o));
    return [...list].sort((a, b) => {
      const ta = a.slotStart ? new Date(a.slotStart).getTime() : 0;
      const tb = b.slotStart ? new Date(b.slotStart).getTime() : 0;
      return ta - tb;
    });
  }, [filter, orders]);

  const openCount = useMemo(() => orders.filter(isOpen).length, [orders]);
  const doneCount = useMemo(() => orders.filter((o) => !isOpen(o)).length, [orders]);

  async function runAction(orderId: string, action: string, visitCashCollected?: boolean) {
    if (!token || actingId) return;
    setActingId(orderId);
    setError(null);
    try {
      const next = await actOnBeautyOrder(token, orderId, {
        action,
        ...(visitCashCollected ? { visitCashCollected: true } : {}),
      });
      setOrders((prev) => prev.map((row) => (row.id === orderId ? next : row)));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update booking');
    } finally {
      setActingId(null);
      setConfirm(null);
    }
  }

  function askAction(order: BeautyOrder, action: string, pay?: ReturnType<typeof beautyPaymentPlanView>) {
    const label = beautyActionLabel(action);
    if (action === 'COMPLETE' && pay && pay.dueAtVisit > 0.01) {
      setConfirm({
        title: 'End session?',
        description: `Confirm the visit is complete for ${order.orderNumber}.`,
        warnBanner: `Collect ${rupee(pay.dueAtVisit)} from the customer before ending. This is recorded for accounts and audit. Also, get rating for your work in the app so they win a scratch card.`,
        action,
        orderId: order.id,
        visitCashCollected: true,
      });
      return;
    }
    setConfirm({
      title: `${label}?`,
      description: `${label} for ${order.orderNumber}.`,
      action,
      orderId: order.id,
    });
  }

  if (loading && orders.length === 0) {
    return (
      <div style={styles.loadingWrap}>
        <span style={styles.loadingDot} aria-hidden />
        <p style={styles.muted}>Loading glam bookings…</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <header style={styles.hero}>
        <div style={styles.heroText}>
          <h2 style={styles.h2}>
            <span style={styles.h2Icon} aria-hidden>
              💄
            </span>
            Glam bookings
          </h2>
          <p style={styles.sub}>
            {openCount} open · {doneCount} done
          </p>
        </div>
        <div style={styles.filters} role="tablist" aria-label="Booking filter">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'open'}
            style={filter === 'open' ? styles.filterOn : styles.filter}
            onClick={() => setFilter('open')}
          >
            Open{openCount > 0 ? ` (${openCount})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'done'}
            style={filter === 'done' ? styles.filterOn : styles.filter}
            onClick={() => setFilter('done')}
          >
            Done
          </button>
        </div>
      </header>

      {error ? (
        <div style={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <Card padding="lg" style={styles.emptyCard}>
          <span style={styles.emptyIcon} aria-hidden>
            ✨
          </span>
          <p style={styles.emptyTitle}>{filter === 'open' ? 'No open bookings' : 'No completed bookings yet'}</p>
          <p style={styles.muted}>
            {filter === 'open'
              ? 'New glam appointments will show up here when buyers book.'
              : 'Finished sessions appear in Done.'}
          </p>
        </Card>
      ) : null}

      <div style={styles.list}>
      {shown.map((order) => {
        const pay = beautyPaymentPlanView(order, 'vendor');
        const primary = primaryBeautyWorkflowAction(order.allowedActions);
        const canCancel = (order.allowedActions ?? []).includes('CANCEL');
        const serviceLine = `${order.serviceLabel ?? order.serviceType} · ${order.venueLabel ?? order.venue}`;
        return (
        <Card key={order.id} elevated padding="sm" style={styles.card}>
          <div style={styles.cardAccent} aria-hidden />
          <div style={styles.cardBody}>
            <div style={styles.mainCol}>
              <div style={styles.titleRow}>
                <strong style={styles.no}>{order.orderNumber}</strong>
                <span style={statusPillStyle(order.status)}>{order.statusLabel}</span>
              </div>
              <p style={styles.serviceLine}>{serviceLine}</p>
              {order.slotStart ? (
                <div style={styles.slotChip}>
                  <span style={styles.slotIcon} aria-hidden>
                    🗓
                  </span>
                  {formatSlot(order.slotStart, order.slotEnd)}
                </div>
              ) : null}
              <div style={styles.detailRow}>
                {order.addressText ? (
                  <span style={styles.detailChip} title={order.addressText}>
                    📍 {order.addressText}
                  </span>
                ) : null}
                {order.studioAddress && order.venue === 'AT_STUDIO' ? (
                  <span style={styles.detailChip} title={order.studioAddress}>
                    🪞 Studio · {order.studioAddress}
                  </span>
                ) : null}
                {order.contactPhone ? (
                  <a href={`tel:${order.contactPhone}`} style={styles.phoneLink}>
                    📞 {order.contactName ?? 'Customer'} · {order.contactPhone}
                  </a>
                ) : null}
              </div>
              {order.specialInstructions ? (
                <div style={styles.noteBox}>
                  <span style={styles.noteLabel}>Note</span>
                  {order.specialInstructions}
                </div>
              ) : null}
              {order.referencePhotoUrl ? (
                <figure style={styles.refWrap}>
                  <img src={order.referencePhotoUrl} alt="Reference look" style={styles.refPhoto} />
                  <figcaption style={styles.refCaption}>Reference look</figcaption>
                </figure>
              ) : null}
            </div>

            <aside style={styles.payPanel}>
              <span style={styles.payPanelLabel}>Total</span>
              <strong style={styles.amount}>{rupee(collectTotal(order))}</strong>
              <div style={styles.payBadges}>
                <span style={pay.plan === 'PARTIAL' ? styles.planPartial : styles.planFull}>{pay.planBadge}</span>
                <span style={paySettlementStyle(pay.settlementTone)}>{pay.settlementBadge}</span>
              </div>
              <p style={styles.payBreakdown}>
                Online <strong>{rupee(pay.paidOnline)}</strong>
                <span style={styles.payDot}>·</span>
                {pay.dueAtVisitLabel} <strong>{rupee(pay.dueAtVisit)}</strong>
              </p>
            </aside>
          </div>

          {primary || canCancel ? (
            <div style={styles.actionBar}>
              {primary ? (
                <div style={styles.primaryActionCol}>
                  <Button
                    variant="primary"
                    size="md"
                    disabled={actingId === order.id}
                    onClick={() => askAction(order, primary, pay)}
                  >
                    {beautyActionLabel(primary)}
                  </Button>
                  {primary === 'COMPLETE' ? <p style={styles.ratingHint}>Ask for a rating — they may win a scratch card</p> : null}
                </div>
              ) : null}
              {canCancel ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={actingId === order.id}
                  onClick={() => askAction(order, 'CANCEL')}
                >
                  {beautyActionLabel('CANCEL')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Card>
        );
      })}
      </div>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm ? beautyActionLabel(confirm.action) : 'OK'}
        warnBanner={confirm?.warnBanner}
        danger={confirm?.action === 'CANCEL'}
        busy={Boolean(confirm && actingId === confirm.orderId)}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void runAction(confirm.orderId, confirm.action, confirm.visitCashCollected);
        }}
      />
    </div>
  );
}

const GLAM = '#be185d';
const GLAM_SOFT = 'color-mix(in srgb, #db2777 12%, var(--bg-elevated))';

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: 'grid',
    gap: '0.75rem',
    marginTop: '0.25rem',
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem 0',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    background: GLAM,
    boxShadow: '0 0 0 4px color-mix(in srgb, #db2777 22%, transparent)',
  },
  hero: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '0.65rem',
    flexWrap: 'wrap',
    padding: '0.85rem 1rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid color-mix(in srgb, #db2777 18%, var(--border))',
    background:
      'linear-gradient(135deg, color-mix(in srgb, #fce7f3 55%, var(--bg-elevated)), var(--bg-elevated) 70%)',
    boxShadow: 'var(--shadow-card)',
  },
  heroText: { display: 'grid', gap: '0.2rem', minWidth: 0 },
  h2: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '1.05rem',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
    fontFamily: 'var(--font-display, inherit)',
  },
  h2Icon: { fontSize: '1.1rem', lineHeight: 1 },
  sub: { margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' },
  filters: {
    display: 'flex',
    gap: '0.3rem',
    padding: 4,
    borderRadius: 999,
    background: 'color-mix(in srgb, var(--bg-muted) 80%, transparent)',
    border: '1px solid var(--border)',
  },
  filter: {
    minHeight: 36,
    padding: '0 0.85rem',
    borderRadius: 999,
    border: '1px solid transparent',
    background: 'transparent',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  filterOn: {
    minHeight: 36,
    padding: '0 0.85rem',
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, #db2777 35%, var(--border))',
    background: 'var(--bg-elevated)',
    color: GLAM,
    fontWeight: 900,
    fontSize: '0.78rem',
    boxShadow: '0 2px 8px color-mix(in srgb, #db2777 12%, transparent)',
    cursor: 'pointer',
  },
  errorBanner: {
    margin: 0,
    padding: '0.55rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid color-mix(in srgb, #b91c1c 35%, var(--border))',
    background: 'var(--danger-soft, #fee2e2)',
    color: 'var(--danger, #b91c1c)',
    fontWeight: 700,
    fontSize: '0.8rem',
  },
  emptyCard: {
    textAlign: 'center',
    display: 'grid',
    gap: '0.35rem',
    justifyItems: 'center',
    border: '1px dashed color-mix(in srgb, #db2777 25%, var(--border))',
    background: 'color-mix(in srgb, #fdf2f8 40%, var(--bg-elevated))',
  },
  emptyIcon: { fontSize: '1.75rem', lineHeight: 1 },
  emptyTitle: { margin: 0, fontWeight: 900, fontSize: '0.95rem', color: 'var(--text)' },
  list: { display: 'grid', gap: '0.65rem' },
  card: {
    position: 'relative',
    overflow: 'hidden',
    padding: 0,
    display: 'grid',
    gap: 0,
    border: '1px solid color-mix(in srgb, #db2777 14%, var(--border))',
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    background: `linear-gradient(180deg, #f472b6, ${GLAM})`,
  },
  cardBody: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.85rem',
    padding: '0.85rem 0.9rem 0.85rem 1rem',
    alignItems: 'flex-start',
  },
  mainCol: { display: 'grid', gap: '0.45rem', flex: '1 1 14rem', minWidth: 0 },
  titleRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' },
  no: { fontSize: '0.95rem', fontWeight: 900, letterSpacing: '-0.02em' },
  statusPill: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '0.18rem 0.5rem',
    borderRadius: 999,
  },
  statusConfirmed: { color: '#9d174d', background: 'color-mix(in srgb, #fce7f3 85%, transparent)' },
  statusLive: { color: '#6d28d9', background: 'color-mix(in srgb, #7c3aed 12%, transparent)' },
  statusEnRoute: { color: '#0f766e', background: 'color-mix(in srgb, #0d9488 12%, transparent)' },
  statusDone: { color: '#047857', background: 'color-mix(in srgb, #10b981 14%, transparent)' },
  statusCancelled: { color: 'var(--danger, #b91c1c)', background: 'var(--danger-soft, #fee2e2)' },
  serviceLine: {
    margin: 0,
    fontSize: '0.86rem',
    fontWeight: 800,
    color: 'var(--text)',
    lineHeight: 1.35,
  },
  slotChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    width: 'fit-content',
    maxWidth: '100%',
    padding: '0.35rem 0.65rem',
    borderRadius: 10,
    fontSize: '0.78rem',
    fontWeight: 800,
    color: 'var(--text)',
    background: GLAM_SOFT,
    border: '1px solid color-mix(in srgb, #db2777 16%, var(--border))',
  },
  slotIcon: { fontSize: '0.9rem', lineHeight: 1 },
  detailRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  detailChip: {
    fontSize: '0.72rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
    padding: '0.22rem 0.5rem',
    borderRadius: 8,
    background: 'var(--bg-muted)',
    border: '1px solid var(--border)',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  phoneLink: {
    fontSize: '0.78rem',
    fontWeight: 800,
    color: GLAM,
    textDecoration: 'none',
    padding: '0.22rem 0.5rem',
    borderRadius: 8,
    border: '1px solid color-mix(in srgb, #db2777 22%, var(--border))',
    background: 'color-mix(in srgb, #fce7f3 50%, var(--bg-elevated))',
  },
  noteBox: {
    fontSize: '0.76rem',
    fontWeight: 600,
    fontStyle: 'italic',
    lineHeight: 1.45,
    color: 'var(--text-muted)',
    padding: '0.45rem 0.6rem',
    borderRadius: 10,
    borderLeft: '3px solid color-mix(in srgb, #db2777 50%, var(--border))',
    background: 'var(--bg-muted)',
  },
  noteLabel: {
    display: 'block',
    fontSize: '0.62rem',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontStyle: 'normal',
    color: GLAM,
    marginBottom: '0.15rem',
  },
  refWrap: { margin: '0.15rem 0 0', display: 'grid', gap: '0.25rem', maxWidth: 220 },
  refPhoto: {
    width: '100%',
    maxHeight: 160,
    borderRadius: 12,
    objectFit: 'cover',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 14px color-mix(in srgb, #000 8%, transparent)',
  },
  refCaption: { margin: 0, fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' },
  payPanel: {
    display: 'grid',
    gap: '0.3rem',
    flex: '0 1 9.5rem',
    minWidth: '8.5rem',
    padding: '0.65rem 0.75rem',
    borderRadius: 12,
    textAlign: 'right',
    justifyItems: 'end',
    alignSelf: 'flex-start',
    background:
      'linear-gradient(145deg, color-mix(in srgb, #fce7f3 35%, var(--bg-elevated)), var(--bg-muted))',
    border: '1px solid color-mix(in srgb, #db2777 12%, var(--border))',
  },
  payPanelLabel: {
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  amount: {
    fontSize: '1.35rem',
    lineHeight: 1.1,
    fontWeight: 900,
    color: GLAM,
    fontFamily: 'var(--font-display, inherit)',
  },
  payBadges: { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', justifyContent: 'flex-end' },
  planFull: {
    fontSize: '0.62rem',
    fontWeight: 900,
    color: '#1d4ed8',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    padding: '0.15rem 0.45rem',
    borderRadius: 999,
  },
  planPartial: {
    fontSize: '0.62rem',
    fontWeight: 900,
    color: '#7e22ce',
    background: '#fdf4ff',
    border: '1px solid #e9d5ff',
    padding: '0.15rem 0.45rem',
    borderRadius: 999,
  },
  payBreakdown: {
    margin: 0,
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    fontWeight: 650,
    lineHeight: 1.45,
    maxWidth: '11rem',
  },
  payDot: { margin: '0 0.15rem', opacity: 0.6 },
  actionBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    alignItems: 'flex-end',
    padding: '0.65rem 0.9rem 0.75rem 1rem',
    borderTop: '1px solid var(--border)',
    background: 'color-mix(in srgb, var(--bg-muted) 55%, var(--bg-elevated))',
  },
  primaryActionCol: { display: 'grid', gap: '0.25rem', justifyItems: 'start' },
  ratingHint: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 650,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    lineHeight: 1.35,
    maxWidth: '16rem',
  },
  muted: { color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, margin: 0 },
};
