import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Badge, Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { formatBuyerPaymentLabel } from '../lib/formatBuyerPaymentLabel';
import { useShop } from '../hooks/useShop';
import { prefetchOrderDetail, summaryToPreview } from '../hooks/useOrderDetail';
import type { OrderSummaryDto } from '../api/shopApi';

const PAGE_SIZE = 20;

type PeriodKey = 'd30' | 'm3' | 'm6' | `y${number}`;

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'brand' {
  const s = status.toLowerCase();
  if (s.includes('deliver') || s.includes('complete') || s.includes('paid')) return 'success';
  if (s.includes('cancel') || s.includes('fail')) return 'danger';
  if (s.includes('pending') || s.includes('placed') || s.includes('confirm')) return 'brand';
  if (s.includes('cod') || s.includes('unpaid')) return 'warning';
  return 'neutral';
}

function formatWhen(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function orderTime(o: OrderSummaryDto): number {
  if (!o.placedAt) return 0;
  const t = new Date(o.placedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function buildPeriodOptions(orders: OrderSummaryDto[]): Array<{ key: PeriodKey; label: string }> {
  const now = new Date();
  const years = new Set<number>();
  years.add(now.getFullYear());
  for (const o of orders) {
    const t = orderTime(o);
    if (t > 0) years.add(new Date(t).getFullYear());
  }
  // Offer a few recent years even if empty, like Amazon.
  for (let y = now.getFullYear() - 1; y >= now.getFullYear() - 3; y -= 1) {
    years.add(y);
  }

  const yearOpts = [...years]
    .sort((a, b) => b - a)
    .map((y) => ({ key: `y${y}` as PeriodKey, label: String(y) }));

  return [
    { key: 'd30', label: 'last 30 days' },
    { key: 'm3', label: 'past 3 months' },
    { key: 'm6', label: 'past 6 months' },
    ...yearOpts,
  ];
}

function matchesPeriod(o: OrderSummaryDto, period: PeriodKey, nowMs: number): boolean {
  const t = orderTime(o);
  if (t <= 0) return false;
  if (period === 'd30') return t >= nowMs - 30 * 24 * 60 * 60 * 1000;
  if (period === 'm3') return t >= nowMs - 90 * 24 * 60 * 60 * 1000;
  if (period === 'm6') return t >= nowMs - 182 * 24 * 60 * 60 * 1000;
  if (period.startsWith('y')) {
    const year = Number(period.slice(1));
    return new Date(t).getFullYear() === year;
  }
  return true;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { orders, cart, loading, error, reload } = useShop();
  const authExpired = Boolean(error && /sign-in expired|invalid jwt|unauthorized/i.test(error));
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('m6');
  const [visible, setVisible] = useState(PAGE_SIZE);

  function openOrder(o: OrderSummaryDto) {
    navigate(`/orders/${o.orderId}`, { state: { preview: summaryToPreview(o) } });
  }

  function warmOrder(o: OrderSummaryDto) {
    if (session?.accessToken) prefetchOrderDetail(session.accessToken, o.orderId);
  }

  const periodOptions = useMemo(() => buildPeriodOptions(orders), [orders]);

  const filtered = useMemo(() => {
    const nowMs = Date.now();
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesPeriod(o, period, nowMs)) return false;
      if (!q) return true;
      const pay = formatBuyerPaymentLabel({
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        orderStatus: o.status,
      });
      const hay = `${o.orderNumber} ${o.displayStatus || o.status} ${pay} ${o.totalAmount}`.toLowerCase();
      return hay.includes(q);
    });
  }, [orders, query, period]);

  const shown = filtered.slice(0, visible);
  const remaining = Math.max(0, filtered.length - shown.length);
  const countLabel = `${filtered.length} order${filtered.length === 1 ? '' : 's'} placed in`;

  return (
    <PortalShell
      title="Orders"
      cartCount={cart?.itemCount ?? 0}
      onRefresh={() => void reload()}
      showDeliveryBanner={false}
      showTownPicker={false}
    >
      {loading && orders.length === 0 ? (
        <LoadingBlock label="Loading your order history…" />
      ) : error && orders.length === 0 ? (
        <EmptyState
          icon="⚠️"
          title={authExpired ? 'Please sign in again' : 'Couldn’t load your orders'}
          description={
            authExpired
              ? 'Your login session expired. Sign in again to see your order history.'
              : 'Something went wrong while fetching your order history. Please try again.'
          }
          actionLabel={authExpired ? 'Sign in' : 'Try again'}
          onAction={() => (authExpired ? navigate('/login') : void reload())}
        >
          {!authExpired ? <p style={styles.errorDetail}>{error}</p> : null}
        </EmptyState>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No orders yet"
          description="When you place a COD order, it will show up here with status updates."
          actionLabel="Shop now"
          onAction={() => navigate('/shop')}
        />
      ) : (
        <div style={styles.wrap}>
          {error ? (
            <Banner tone="warning">
              Couldn’t refresh fully. Showing your last loaded orders.{' '}
              <button type="button" style={styles.linkBtn} onClick={() => void reload()}>
                Retry
              </button>
            </Banner>
          ) : null}

          <div style={styles.periodRow}>
            <span style={styles.periodText}>{countLabel}</span>
            <label style={styles.periodLabel}>
              <select
                style={styles.periodSelect}
                value={period}
                aria-label="Filter orders by time period"
                onChange={(e) => {
                  setPeriod(e.target.value as PeriodKey);
                  setVisible(PAGE_SIZE);
                }}
              >
                {periodOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={styles.toolbar}>
            <input
              style={styles.search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Search in this period…"
              aria-label="Search orders"
            />
          </div>

          {filtered.length === 0 ? (
            <p style={styles.emptyFilter}>
              {query.trim()
                ? `No matches for “${query.trim()}” in this period.`
                : 'No orders in this period.'}
            </p>
          ) : (
            <>
              <div style={styles.list}>
                {shown.map((o, index) => {
                  const status = o.displayStatus || o.status;
                  const pay = formatBuyerPaymentLabel({
                    paymentMethod: o.paymentMethod,
                    paymentStatus: o.paymentStatus,
                    orderStatus: o.status,
                  });
                  return (
                    <button
                      key={o.orderId}
                      type="button"
                      style={{
                        ...styles.row,
                        borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                      }}
                      onPointerEnter={() => warmOrder(o)}
                      onFocus={() => warmOrder(o)}
                      onClick={() => openOrder(o)}
                    >
                      <div style={styles.rowMain}>
                        <div style={styles.rowTop}>
                          <p style={styles.name}>{o.orderNumber}</p>
                          <Badge tone={statusTone(status)}>{status}</Badge>
                        </div>
                        <p style={styles.meta}>
                          {formatWhen(o.placedAt)}
                          {' · '}
                          {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                          {' · '}
                          {pay}
                        </p>
                      </div>
                      <div style={styles.rowSide}>
                        <p style={styles.amount}>₹{Number(o.totalAmount).toFixed(0)}</p>
                        <p style={styles.chevron}>›</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {remaining > 0 ? (
                <button
                  type="button"
                  style={styles.moreBtn}
                  onClick={() => setVisible((n) => n + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} left
                </button>
              ) : null}
            </>
          )}
        </div>
      )}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem' },
  periodRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.45rem',
  },
  periodText: {
    color: 'var(--text)',
    fontSize: '0.92rem',
    fontWeight: 650,
  },
  periodLabel: { display: 'inline-flex', margin: 0 },
  periodSelect: {
    appearance: 'auto',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '0.35rem 0.55rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  toolbar: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  search: {
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '0.55rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  emptyFilter: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' },
  list: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.65rem',
    alignItems: 'center',
    width: '100%',
    padding: '0.55rem 0.75rem',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
  },
  rowMain: { display: 'grid', gap: '0.15rem', minWidth: 0, flex: 1 },
  rowTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    minWidth: 0,
  },
  name: {
    margin: 0,
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    fontSize: '0.82rem',
    lineHeight: 1.25,
    wordBreak: 'break-all',
    minWidth: 0,
    flex: 1,
  },
  meta: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rowSide: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexShrink: 0,
  },
  amount: {
    margin: 0,
    color: 'var(--text)',
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.95rem',
  },
  chevron: { margin: 0, color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 700 },
  moreBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.45rem 0.9rem',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    justifySelf: 'center',
  },
  errorDetail: { margin: '0.35rem 0 0', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
};
