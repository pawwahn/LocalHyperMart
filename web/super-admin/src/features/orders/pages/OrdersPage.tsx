import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, SearchSelect } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  formatWhen,
  listAdminOrders,
  money,
  shortOrderNo,
  type AdminOrderSummary,
} from '../api/ordersApi';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PAYMENT_PENDING', label: 'Payment pending' },
  { value: 'PAYMENT_FAILED', label: 'Payment failed' },
];

const PAGE_SIZE = 25;

function townLabel(t: TownVm): string {
  const place = t.displayName || t.townCode;
  const bits = [place, t.townCode && t.townCode !== place ? t.townCode : null].filter(Boolean);
  return bits.join(' · ');
}

export function OrdersPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTownApplied = useRef(false);

  const [towns, setTowns] = useState<TownVm[]>([]);
  const townId = searchParams.get('townId') ?? '';
  const status = searchParams.get('status') ?? '';
  const qParam = searchParams.get('q') ?? '';
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0);

  const [queryDraft, setQueryDraft] = useState(qParam);
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const townOptions = useMemo(
    () =>
      towns.map((t) => ({
        value: t.id,
        label: townLabel(t),
        searchText: `${t.displayName} ${t.townCode} ${t.stateCode ?? ''}`,
      })),
    [towns],
  );

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listTowns(token);
        if (cancelled) return;
        setTowns(list);
        if (!defaultTownApplied.current && !searchParams.get('townId') && list.length > 0) {
          defaultTownApplied.current = true;
          patchParams({ townId: list[0].id });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load towns');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, patchParams, searchParams]);

  const reloadOrders = useCallback(async () => {
    if (!token || !townId) {
      setOrders([]);
      setTotalPages(0);
      setTotalElements(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminOrders(token, townId, {
        status: status || undefined,
        q: qParam || undefined,
        page,
        size: PAGE_SIZE,
      });
      setOrders(data.items ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err) {
      setOrders([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token, townId, status, qParam, page]);

  useEffect(() => {
    void reloadOrders();
  }, [reloadOrders]);

  useEffect(() => {
    setQueryDraft(qParam);
  }, [qParam]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    patchParams({ q: queryDraft.trim() || null, page: null });
  }

  return (
    <PortalShell title="Orders" onRefresh={() => void reloadOrders()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <div style={styles.toolbar}>
        <div style={styles.townWrap}>
          <SearchSelect
            label="Town"
            value={townId}
            options={townOptions}
            onChange={(id) => patchParams({ townId: id || null, page: null })}
            placeholder="Select town…"
            emptyMessage="No towns"
          />
        </div>
        <form style={styles.searchForm} onSubmit={onSearch}>
          <input
            style={styles.search}
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            placeholder="Search order # or phone…"
            aria-label="Search order number or phone"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      <div style={styles.statusRow} role="tablist" aria-label="Order status">
        {STATUSES.map((s) => {
          const active = status === s.value;
          return (
            <button
              key={s.value || 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              style={active ? styles.statusActive : styles.statusBtn}
              onClick={() => patchParams({ status: s.value || null, page: null })}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <p style={styles.meta}>
        {townId
          ? loading
            ? 'Loading…'
            : `${totalElements} order${totalElements === 1 ? '' : 's'}`
          : 'Pick a town to view orders'}
      </p>

      {!townId ? null : loading && orders.length === 0 ? (
        <p style={styles.empty}>Loading orders…</p>
      ) : orders.length === 0 ? (
        <p style={styles.empty}>No orders match.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Order</th>
                <th style={styles.th}>Buyer</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Payment</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                <th style={styles.th}>Bags</th>
                <th style={styles.th}>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId}>
                  <td style={styles.td}>
                    <Link
                      to={`/orders/${o.orderId}?townId=${encodeURIComponent(townId)}`}
                      style={styles.link}
                      title={o.orderNumber}
                    >
                      {shortOrderNo(o.orderNumber)}
                    </Link>
                  </td>
                  <td style={styles.tdMuted}>
                    {o.buyerPhone ? (
                      <a href={`tel:${o.buyerPhone}`} style={styles.link}>
                        {o.buyerPhone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.pill}>{o.status}</span>
                  </td>
                  <td style={styles.tdMuted}>{o.paymentStatus}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>
                    {money(o.totalAmount)}
                  </td>
                  <td style={styles.tdMuted}>
                    {o.readySubOrderCount}/{o.subOrderCount}
                  </td>
                  <td style={styles.tdMuted}>{formatWhen(o.placedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div style={styles.pager}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 0 || loading}
            onClick={() => patchParams({ page: String(page - 1) })}
          >
            Prev
          </Button>
          <span style={styles.pageLabel}>
            Page {page + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => patchParams({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    alignItems: 'flex-end',
    marginBottom: '0.65rem',
  },
  townWrap: { minWidth: '14rem', flex: '1 1 14rem' },
  searchForm: { display: 'flex', gap: '0.45rem', flex: '2 1 16rem', alignItems: 'center' },
  search: {
    flex: 1,
    boxSizing: 'border-box',
    padding: '0.55rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  statusRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.55rem' },
  statusBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.28rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  statusActive: {
    border: '1px solid color-mix(in srgb, var(--accent) 55%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 16%, var(--bg-elevated))',
    color: 'var(--text)',
    borderRadius: 'var(--radius-full)',
    padding: '0.28rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  meta: { margin: '0 0 0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  empty: { margin: '1rem 0', color: 'var(--text-muted)' },
  tableWrap: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'auto',
    background: 'var(--bg-elevated)',
  },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '40rem' },
  th: {
    textAlign: 'left',
    padding: '0.55rem 0.7rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
    background: 'color-mix(in srgb, var(--bg) 55%, var(--bg-elevated))',
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '0.55rem 0.7rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.86rem',
    verticalAlign: 'middle',
  },
  tdMuted: {
    padding: '0.55rem 0.7rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
  },
  link: { color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' },
  pill: {
    display: 'inline-block',
    padding: '0.12rem 0.45rem',
    borderRadius: 'var(--radius-full)',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg))',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
  pageLabel: { color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
};
