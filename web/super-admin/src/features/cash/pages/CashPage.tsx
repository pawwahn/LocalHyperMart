import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { DEFAULT_REPORT_DATE_PRESET, isoIstDate, rangeForReportPreset, type ReportDatePreset } from '@hlm-dates/istReportPresets';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, SearchSelect } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import {
  formatAdminPaymentLabel,
  formatWhen,
  listAdminOrders,
  lookupAdminCodCashHolders,
  lookupAdminOrderSettlements,
  money,
  shortOrderNo,
  type AdminOrderCashHolder,
  type AdminOrderSummary,
} from '@/features/orders/api/ordersApi';
import { describeCash, type CashBucket } from '../cashPlace';
import { describeSettlement, type AppSettlement, type CommissionFrom, type CommissionState } from '../cashSettlement';
import { CashDetailDialog } from '../components/CashDetailDialog';

const PAGE_SIZE = 25;

const PAY_FILTERS = [
  { value: '', label: 'All pay' },
  { value: 'COD', label: 'Cash' },
  { value: 'ONLINE', label: 'Online' },
] as const;

const STATUS_FILTERS = [
  { value: '', label: 'All status' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

const PLACE_FILTERS: Array<{ value: '' | CashBucket; label: string }> = [
  { value: '', label: 'All places' },
  { value: 'not_collected', label: 'Customer has it' },
  { value: 'rider', label: 'Rider has it' },
  { value: 'hub', label: 'At the hub' },
  { value: 'shop', label: 'Shop has it' },
  { value: 'company', label: 'With KoyaKart' },
  { value: 'online', label: 'Cash with App' },
];

function townLabel(t: TownVm): string {
  const place = t.displayName || t.townCode;
  return [place, t.townCode && t.townCode !== place ? t.townCode : null].filter(Boolean).join(' · ');
}

function isPreset(value: string | null): value is ReportDatePreset {
  return (
    value === 'today' ||
    value === 'week' ||
    value === 'days30' ||
    value === 'month' ||
    value === 'previousMonth' ||
    value === 'q1' ||
    value === 'q2' ||
    value === 'q3' ||
    value === 'q4' ||
    value === 'firstHalf' ||
    value === 'secondHalf' ||
    value === 'annual' ||
    value === 'financialYear' ||
    value === 'custom'
  );
}

export function CashPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTownApplied = useRef(false);
  const presetClick = useRef(false);
  const loadSeq = useRef(0);

  const initial = rangeForReportPreset(DEFAULT_REPORT_DATE_PRESET);
  const preset: ReportDatePreset = isPreset(searchParams.get('preset')) ? searchParams.get('preset')! : DEFAULT_REPORT_DATE_PRESET;
  const from = searchParams.get('from') || initial.from;
  const to = searchParams.get('to') || initial.to;
  const townId = searchParams.get('townId') ?? '';
  const pay = searchParams.get('pay') ?? '';
  const status = searchParams.get('status') ?? '';
  const qParam = searchParams.get('q') ?? '';
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0);
  const place = (searchParams.get('place') ?? '') as '' | CashBucket;
  const settle = (searchParams.get('settle') ?? '') as '' | CommissionState;
  const owes = (searchParams.get('owes') ?? '') as '' | CommissionFrom;

  const [towns, setTowns] = useState<TownVm[]>([]);
  const [queryDraft, setQueryDraft] = useState(qParam);
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [cashHolders, setCashHolders] = useState<Record<string, AdminOrderCashHolder>>({});
  const [settlements, setSettlements] = useState<Record<string, AppSettlement>>({});
  const [holdersReady, setHoldersReady] = useState(false);
  const [settlementsReady, setSettlementsReady] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const queued = useRef<Record<string, string | null>>({});
  const queuePatch = useCallback(
    (patch: Record<string, string | null>) => {
      queued.current = { ...queued.current, ...patch };
      const pending = queued.current;
      queueMicrotask(() => {
        if (queued.current !== pending) return;
        queued.current = {};
        patchParams(pending);
      });
    },
    [patchParams],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void listTowns(token)
      .then((list) => {
        if (cancelled) return;
        setTowns(list);
        if (!defaultTownApplied.current && !townId && list[0]) {
          defaultTownApplied.current = true;
          const range = rangeForReportPreset(DEFAULT_REPORT_DATE_PRESET);
          patchParams({ townId: list[0].id, preset: DEFAULT_REPORT_DATE_PRESET, from: range.from, to: range.to });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load towns');
      });
    return () => {
      cancelled = true;
    };
    // Town list is loaded once. The date range must not refetch it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, patchParams]);

  useEffect(() => {
    setQueryDraft(qParam);
  }, [qParam]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = queryDraft.trim();
      if (next === qParam) return;
      patchParams({ q: next || null, page: null });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [queryDraft, qParam, patchParams]);

  const reload = useCallback(async () => {
    if (!token || !townId || !from || !to) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    setHoldersReady(false);
    setSettlementsReady(false);
    try {
      const data = await listAdminOrders(token, {
        townId,
        status: status || undefined,
        q: qParam || undefined,
        from,
        to,
        paymentMethod: pay || undefined,
        page,
        size: PAGE_SIZE,
      });
      if (seq !== loadSeq.current) return;
      const items = data.items ?? [];
      setOrders(items);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
      setLoading(false);
      const orderIds = items.map((o) => o.orderId);
      const codIds = items.filter((o) => (o.paymentMethod ?? '').toUpperCase() === 'COD').map((o) => o.orderId);
      const holdersPromise = codIds.length === 0
        ? Promise.resolve({} as Record<string, AdminOrderCashHolder>)
        : lookupAdminCodCashHolders(token, codIds).catch(() => ({} as Record<string, AdminOrderCashHolder>));
      const settlementsPromise = orderIds.length === 0
        ? Promise.resolve({} as Record<string, AppSettlement>)
        : lookupAdminOrderSettlements(token, orderIds).catch(() => ({} as Record<string, AppSettlement>));
      const [holders, settled] = await Promise.all([holdersPromise, settlementsPromise]);
      if (seq !== loadSeq.current) return;
      setCashHolders(holders);
      setSettlements(settled);
      setHoldersReady(true);
      setSettlementsReady(true);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load cash');
      setLoading(false);
      setHoldersReady(true);
      setSettlementsReady(true);
    }
  }, [token, townId, from, to, status, qParam, pay, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const townOptions = useMemo(
    () =>
      towns.map((t) => ({
        value: t.id,
        label: townLabel(t),
        searchText: `${t.displayName} ${t.townCode} ${t.stateCode ?? ''}`,
      })),
    [towns],
  );

  const described = useMemo(
    () =>
      orders.map((order) => ({
        order,
        place: describeCash(order, cashHolders[order.orderId], holdersReady || (order.paymentMethod ?? '').toUpperCase() !== 'COD'),
        settlement: describeSettlement(
          order,
          cashHolders[order.orderId],
          settlements[order.orderId],
          settlementsReady && (holdersReady || (order.paymentMethod ?? '').toUpperCase() !== 'COD'),
        ),
      })),
    [orders, cashHolders, holdersReady, settlements, settlementsReady],
  );

  const visible = useMemo(
    () =>
      described.filter((row) => {
        if (place && row.place.bucket !== place) return false;
        if (settle && row.settlement.state !== settle) return false;
        if (owes && row.settlement.from !== owes) return false;
        return true;
      }),
    [described, place, settle, owes],
  );

  const counts = useMemo(() => {
    const out: Partial<Record<CashBucket, number>> = {};
    for (const row of described) {
      if (row.place.bucket === 'unknown') continue;
      out[row.place.bucket] = (out[row.place.bucket] ?? 0) + 1;
    }
    return out;
  }, [described]);

  const commissionCounts = useMemo(() => {
    const out = { settled: 0, unsettled: 0, not_due: 0, vendor: 0, hub: 0, agent: 0 };
    for (const row of described) {
      if (row.settlement.state === 'settled') out.settled += 1;
      else if (row.settlement.state === 'unsettled') out.unsettled += 1;
      else if (row.settlement.state === 'not_due') out.not_due += 1;
      if (row.settlement.state === 'unsettled' && row.settlement.from === 'vendor') out.vendor += 1;
      if (row.settlement.state === 'unsettled' && row.settlement.from === 'hub') out.hub += 1;
      if (row.settlement.state === 'unsettled' && row.settlement.from === 'agent') out.agent += 1;
    }
    return out;
  }, [described]);

  const selected = described.find((row) => row.order.orderId === selectedId) ?? null;

  return (
    <PortalShell title="Cash" subtitle="Who has the cash, and which orders still owe KoyaKart its commission" onRefresh={() => void reload()}>
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
        <input
          style={styles.search}
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          placeholder="Order # or phone"
          aria-label="Search order number or phone"
        />
      </div>

      <DateRangePresetBar
        dense
        twoRows
        preset={preset}
        from={from}
        to={to}
        maxDate={isoIstDate()}
        ariaLabel="Cash date range"
        onPresetChange={(next) => {
          presetClick.current = next !== 'custom';
          queuePatch({ preset: next, page: null });
        }}
        onFromChange={(value) => {
          if (presetClick.current) queuePatch({ from: value, page: null });
          else queuePatch({ from: value, preset: 'custom', page: null });
        }}
        onToChange={(value) => {
          const fromPreset = presetClick.current;
          presetClick.current = false;
          if (fromPreset) queuePatch({ to: value, page: null });
          else queuePatch({ to: value, preset: 'custom', page: null });
        }}
      />

      <div style={styles.filterPanel}>
        <div style={styles.filterPair}>
          <div style={styles.filterBox} role="group" aria-label="Payment">
            <span style={styles.filterLabel}>Pay</span>
            <div style={styles.chips}>
              {PAY_FILTERS.map((item) => (
                <FilterChip
                  key={item.value || 'pay-all'}
                  active={pay === item.value}
                  label={item.label}
                  onClick={() => patchParams({ pay: item.value || null, page: null })}
                />
              ))}
            </div>
          </div>
          <div style={{ ...styles.filterBox, ...styles.filterBoxStatus }} role="group" aria-label="Order status">
            <span style={styles.filterLabel}>Status</span>
            <div style={styles.chips}>
              {STATUS_FILTERS.map((item) => (
                <FilterChip
                  key={item.value || 'status-all'}
                  active={status === item.value}
                  label={item.label}
                  onClick={() => patchParams({ status: item.value || null, page: null })}
                />
              ))}
            </div>
          </div>
        </div>
        <div style={{ ...styles.filterRow, ...styles.filterRowSplit }}>
          <span style={styles.filterLabel}>Place</span>
          <div style={styles.chips} role="group" aria-label="Where the cash is">
            {PLACE_FILTERS.map((item) => {
              const count = item.value ? counts[item.value] : described.filter((row) => row.place.bucket !== 'unknown').length;
              const label = holdersReady && item.value ? `${item.label} ${count ?? 0}` : item.label;
              return (
                <FilterChip
                  key={item.value || 'place-all'}
                  active={place === item.value}
                  label={item.value ? label : holdersReady ? `All places ${count ?? 0}` : item.label}
                  disabled={!holdersReady && Boolean(item.value)}
                  onClick={() => patchParams({ place: item.value || null })}
                />
              );
            })}
          </div>
        </div>
        <div style={{ ...styles.filterRow, ...styles.filterRowSplit }}>
          <span style={styles.filterLabel}>Commission</span>
          <div style={styles.chips} role="group" aria-label="Whether KoyaKart has its commission">
            <FilterChip active={!settle} label={settlementsReady ? `All ${described.length}` : 'All'} onClick={() => patchParams({ settle: null, owes: null })} />
            <FilterChip
              active={settle === 'unsettled' && !owes}
              label={settlementsReady ? `Unsettled ${commissionCounts.unsettled}` : 'Unsettled'}
              disabled={!settlementsReady}
              onClick={() => patchParams({ settle: 'unsettled', owes: null })}
            />
            <FilterChip
              active={settle === 'settled'}
              label={settlementsReady ? `Settled ${commissionCounts.settled}` : 'Settled'}
              disabled={!settlementsReady}
              onClick={() => patchParams({ settle: 'settled', owes: null })}
            />
            <FilterChip
              active={settle === 'not_due'}
              label={settlementsReady ? `Not due ${commissionCounts.not_due}` : 'Not due'}
              disabled={!settlementsReady}
              onClick={() => patchParams({ settle: 'not_due', owes: null })}
            />
            <span style={styles.owesRule} aria-hidden />
            <FilterChip
              active={owes === 'vendor'}
              label={settlementsReady ? `Vendor ${commissionCounts.vendor}` : 'Vendor'}
              disabled={!settlementsReady}
              onClick={() => patchParams({ settle: 'unsettled', owes: 'vendor' })}
            />
            <FilterChip
              active={owes === 'hub'}
              label={settlementsReady ? `Hub ${commissionCounts.hub}` : 'Hub'}
              disabled={!settlementsReady}
              onClick={() => patchParams({ settle: 'unsettled', owes: 'hub' })}
            />
            <FilterChip
              active={owes === 'agent'}
              label={settlementsReady ? `Agent ${commissionCounts.agent}` : 'Agent'}
              disabled={!settlementsReady}
              onClick={() => patchParams({ settle: 'unsettled', owes: 'agent' })}
            />
          </div>
        </div>
      </div>

      <p style={styles.meta}>
        {!townId
          ? 'Pick a town'
          : loading && orders.length === 0
            ? 'Loading…'
            : `${totalElements} order${totalElements === 1 ? '' : 's'} in this range${
                place || settle || owes ? ` · ${visible.length} on this page match` : ''
              }${loading ? ' · updating' : ''}`}
      </p>

      {!townId ? null : orders.length === 0 && !loading ? (
        <p style={styles.empty}>No orders in this range.</p>
      ) : visible.length === 0 && !loading ? (
        <p style={styles.empty}>Nothing on this page matches these filters. Try the next page or clear a filter.</p>
      ) : (
        <div style={{ ...styles.tableWrap, opacity: loading ? 0.72 : 1 }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Order</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Order amount</th>
                <th style={styles.th}>Placed</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Payment</th>
                <th style={styles.th}>Cash with</th>
                <th style={styles.th}>Settlement</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ order, place: rowPlace, settlement }) => (
                <tr key={order.orderId}>
                  <td style={styles.td}>
                    <button type="button" style={styles.orderBtn} onClick={() => setSelectedId(order.orderId)}>
                      {shortOrderNo(order.orderNumber)}
                    </button>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800 }}>{money(order.totalAmount)}</td>
                  <td style={styles.tdMuted}>{formatWhen(order.placedAt)}</td>
                  <td style={styles.td}>
                    <span style={styles.pill}>{order.status}</span>
                  </td>
                  <td style={styles.tdMuted}>
                    {formatAdminPaymentLabel({
                      paymentMethod: order.paymentMethod,
                      paymentStatus: order.paymentStatus,
                      orderStatus: order.status,
                    })}
                  </td>
                  <td style={styles.td}>
                    <button type="button" style={styles.placeBtn} title={rowPlace.sentence} onClick={() => setSelectedId(order.orderId)}>
                      <span style={styles.placeTitle}>{rowPlace.title}</span>
                      {rowPlace.detail ? <span style={styles.placeDetail}>{rowPlace.detail}</span> : null}
                    </button>
                  </td>
                  <td style={styles.td}>
                    <button type="button" style={styles.placeBtn} title={settlement.detail} onClick={() => setSelectedId(order.orderId)}>
                      <span style={{ ...styles.placeTitle, ...commissionTone(settlement.state) }}>{settlement.title}</span>
                      <span style={styles.placeDetail}>{settlement.detail}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div style={styles.pager}>
          <Button type="button" variant="secondary" size="sm" disabled={page <= 0 || loading} onClick={() => patchParams({ page: String(page - 1) })}>
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

      {selected ? (
        <CashDetailDialog
          order={selected.order}
          token={token}
          townId={townId}
          townLabel={(() => {
            const town = towns.find((t) => t.id === townId);
            return town ? townLabel(town) : '';
          })()}
          place={selected.place}
          settlement={selected.settlement}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      <p style={styles.foot}>
        Open an order from <Link to="/orders">Orders</Link> for the full bag. Settlement means KoyaKart has its commission.
      </p>
    </PortalShell>
  );
}

function commissionTone(state: CommissionState): CSSProperties {
  if (state === 'unsettled') return { color: '#c2410c' };
  if (state === 'settled') return { color: '#047857' };
  return { color: 'var(--text-muted)' };
}

function FilterChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      style={{ ...(active ? styles.chipOn : styles.chip), ...(disabled ? { opacity: 0.55, cursor: 'default' } : null) }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'flex-end', marginBottom: '0.35rem' },
  townWrap: { minWidth: '12rem', flex: '1 1 14rem' },
  search: {
    flex: '1 1 12rem',
    boxSizing: 'border-box',
    minHeight: 40,
    padding: '0.4rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.86rem',
  },
  filterPanel: {
    marginTop: '0.45rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
    overflow: 'hidden',
  },
  filterPair: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.38rem 0.45rem',
  },
  filterBox: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem 0.45rem',
    padding: '0.22rem 0.45rem',
    border: '1px solid color-mix(in srgb, var(--accent) 28%, var(--border))',
    borderRadius: 10,
    background: 'color-mix(in srgb, var(--accent) 7%, var(--bg-elevated))',
  },
  filterBoxStatus: {
    borderColor: 'color-mix(in srgb, #2563eb 28%, var(--border))',
    background: 'color-mix(in srgb, #2563eb 6%, var(--bg-elevated))',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.35rem 0.5rem',
    padding: '0.32rem 0.55rem',
  },
  filterRowSplit: { borderTop: '1px solid var(--border)' },
  owesRule: { width: 1, alignSelf: 'stretch', margin: '0.1rem 0.15rem', background: 'var(--border)' },
  filterLabel: {
    flex: '0 0 auto',
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.28rem', minWidth: 0 },
  chip: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-full)',
    padding: '0.22rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  chipOn: {
    border: '1px solid color-mix(in srgb, var(--accent) 55%, var(--border))',
    background: 'color-mix(in srgb, var(--accent) 16%, var(--bg-elevated))',
    color: 'var(--text)',
    borderRadius: 'var(--radius-full)',
    padding: '0.22rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  meta: { margin: '0.45rem 0 0.35rem', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 650 },
  empty: { margin: '0.6rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' },
  tableWrap: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
  },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    textAlign: 'left',
    padding: '0.45rem 0.6rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
    background: 'color-mix(in srgb, var(--bg) 55%, var(--bg-elevated))',
    position: 'sticky',
    top: 0,
  },
  td: { padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.84rem', verticalAlign: 'middle' },
  tdMuted: { padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)', verticalAlign: 'middle' },
  pill: {
    display: 'inline-flex',
    padding: '0.08rem 0.4rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    fontSize: '0.68rem',
    fontWeight: 800,
  },
  orderBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 800,
    fontSize: '0.84rem',
    cursor: 'pointer',
    padding: 0,
  },
  placeBtn: {
    display: 'grid',
    justifyItems: 'start',
    gap: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
  },
  placeTitle: { fontWeight: 800, fontSize: '0.82rem', lineHeight: 1.25 },
  placeDetail: { fontSize: '0.74rem', fontWeight: 650, color: 'var(--text-muted)', lineHeight: 1.3, whiteSpace: 'normal' },
  pager: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' },
  pageLabel: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' },
  foot: { margin: '0.55rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' },
};
