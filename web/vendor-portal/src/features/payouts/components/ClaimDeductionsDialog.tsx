import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { Button } from '@/shared/ui';
import { formatMoney } from '@/features/reports/api/reportsApi';
import type { VendorClaimAdjustment } from '@/features/reports/api/payoutsApi';
import { TablePager, pageWindow } from '@/shared/table';
import { ClaimOrderDetailDialog } from '@/features/payouts/components/ClaimOrderDetailDialog';

type Props = {
  open: boolean;
  items: VendorClaimAdjustment[];
  onClose: () => void;
};

type StatusFilter = 'all' | 'PENDING' | 'APPLIED';

const PAGE_SIZE = 10;

type ParsedClaimReason = {
  claimTypeLabel: string;
  itemName: string;
  buyerNote: string | null;
};

function toDayKey(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function claimTypeLabel(code?: string | null): string {
  switch ((code ?? '').toUpperCase()) {
    case 'WRONG_ITEM':
      return 'Wrong item / qty';
    case 'MISSING':
      return 'Missing item';
    case 'DAMAGED':
      return 'Damaged';
    default:
      return code ? code.replace(/_/g, ' ') : 'Claim';
  }
}

/** Parses chargeback reason lines written by order-service. */
function parseClaimReason(reason?: string | null): ParsedClaimReason {
  if (!reason?.trim()) {
    return { claimTypeLabel: 'Claim', itemName: 'Item', buyerNote: null };
  }
  const typeMatch = reason.match(/\(([^)]+)\)/);
  const typeLabel = claimTypeLabel(typeMatch?.[1]);

  const withBuyer = reason.match(/:\s*(.+?)\s*[—–-]\s*buyer:\s*(.+?)\s*[—–-]\s*credited/i);
  if (withBuyer) {
    return {
      claimTypeLabel: typeLabel,
      itemName: withBuyer[1].trim(),
      buyerNote: withBuyer[2].trim(),
    };
  }

  const legacy = reason.match(/:\s*(.+?)\s*[—–-]\s*buyer credited/i);
  if (legacy) {
    return { claimTypeLabel: typeLabel, itemName: legacy[1].trim(), buyerNote: null };
  }

  return {
    claimTypeLabel: typeLabel,
    itemName: reason.length > 72 ? `${reason.slice(0, 70)}…` : reason,
    buyerNote: null,
  };
}

export function ClaimDeductionsDialog({ open, items, onClose }: Props) {
  const titleId = useId();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [detailAdj, setDetailAdj] = useState<VendorClaimAdjustment | null>(null);

  useEffect(() => {
    if (!open) {
      setDetailAdj(null);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !detailAdj) onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, detailAdj]);

  useEffect(() => {
    if (!open) return;
    setPage(0);
  }, [open, statusFilter, fromDate, toDate]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      const day = toDayKey(a.createdAt);
      if (fromDate && (!day || day < fromDate)) return false;
      if (toDate && (!day || day > toDate)) return false;
      return true;
    });
  }, [items, statusFilter, fromDate, toDate]);

  const totalPending = useMemo(
    () => filtered.filter((a) => a.status === 'PENDING').reduce((s, a) => s + Number(a.amount ?? 0), 0),
    [filtered],
  );

  const { total, totalPages, safePage, from, to, pageItems } = useMemo(
    () => pageWindow(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  if (!open) return null;

  return (
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !detailAdj) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={styles.header}>
          <div>
            <h2 id={titleId} style={styles.title}>
              Claim deductions
            </h2>
            <p style={styles.subtitle}>Taken from your next payout · {filtered.length} shown</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div style={styles.filters}>
          <select
            style={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Claim status"
          >
            <option value="all">All status</option>
            <option value="PENDING">Pending</option>
            <option value="APPLIED">Applied</option>
          </select>
          <label style={styles.dateField}>
            <span style={styles.dateLabel}>From</span>
            <input
              type="date"
              style={styles.dateInput}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label style={styles.dateField}>
            <span style={styles.dateLabel}>To</span>
            <input
              type="date"
              style={styles.dateInput}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          {fromDate || toDate || statusFilter !== 'all' ? (
            <button
              type="button"
              style={styles.clearBtn}
              onClick={() => {
                setStatusFilter('all');
                setFromDate('');
                setToDate('');
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        <p style={styles.summaryLine}>
          Pending in view:{' '}
          <strong style={styles.summaryAmt}>{formatMoney(totalPending)}</strong>
        </p>

        <div style={styles.listWrap}>
          {pageItems.length === 0 ? (
            <p style={styles.empty}>No claim deductions in this range.</p>
          ) : (
            <ul style={styles.list}>
              {pageItems.map((a) => {
                const parsed = parseClaimReason(a.reason);
                return (
                  <li key={a.id} style={styles.item}>
                    <strong style={styles.amount}>−{formatMoney(a.amount)}</strong>
                    <div style={styles.main}>
                      <button
                        type="button"
                        style={styles.orderLink}
                        title="View your bag for this order"
                        onClick={() => setDetailAdj(a)}
                      >
                        {a.orderNumber?.trim() || 'Order'}
                      </button>
                      <span style={styles.typeLine}>
                        {parsed.claimTypeLabel}
                        {parsed.itemName ? ` · ${parsed.itemName}` : ''}
                      </span>
                      {parsed.buyerNote ? (
                        <span style={styles.buyerNote} title={parsed.buyerNote}>
                          Buyer: {parsed.buyerNote}
                        </span>
                      ) : null}
                    </div>
                    <span style={a.status === 'PENDING' ? styles.pending : styles.applied}>
                      {a.status === 'PENDING' ? 'Pending' : 'Applied'}
                    </span>
                    {a.createdAt ? (
                      <span style={styles.when}>
                        {new Date(a.createdAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </span>
                    ) : (
                      <span style={styles.when}>—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {total > 0 ? (
          <div style={styles.pager}>
            <TablePager
              total={total}
              from={from}
              to={to}
              page={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </div>

      <ClaimOrderDetailDialog
        open={Boolean(detailAdj)}
        subOrderId={detailAdj?.subOrderId ?? null}
        highlightItemId={detailAdj?.orderItemId}
        orderNumberHint={detailAdj?.orderNumber}
        onClose={() => setDetailAdj(null)}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 20, 0.45)',
    backdropFilter: 'blur(2px)',
  },
  dialog: {
    width: 'min(52rem, 96vw)',
    maxHeight: 'min(88vh, 760px)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1rem 1.15rem 0.85rem',
    display: 'grid',
    gridTemplateRows: 'auto auto auto minmax(0, 1fr) auto',
    gap: '0.65rem',
    animation: 'hlm-fade-up 180ms ease both',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.15rem',
    color: 'var(--text)',
  },
  subtitle: { margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    alignItems: 'flex-end',
  },
  select: {
    padding: '0.35rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.8rem',
  },
  dateField: { display: 'grid', gap: '0.15rem' },
  dateLabel: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' },
  dateInput: {
    padding: '0.3rem 0.4rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.8rem',
  },
  clearBtn: {
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '0.35rem 0.2rem',
  },
  summaryLine: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  summaryAmt: { color: '#7c3aed', fontWeight: 800 },
  listWrap: { minHeight: 0, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' },
  list: { listStyle: 'none', margin: 0, padding: '0.3rem', display: 'grid', gap: '0.3rem' },
  empty: { margin: 0, padding: '1.25rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' },
  item: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
    gap: '0.4rem',
    alignItems: 'center',
    padding: '0.4rem 0.45rem',
    borderRadius: 'var(--radius-sm, 6px)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  },
  amount: { fontSize: '0.88rem', fontWeight: 800, color: '#7c3aed', whiteSpace: 'nowrap' },
  main: { display: 'grid', gap: '0.08rem', minWidth: 0 },
  orderLink: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '0.74rem',
    fontWeight: 800,
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    color: 'var(--accent-hover, var(--accent))',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typeLine: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  buyerNote: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pending: {
    fontSize: '0.62rem',
    fontWeight: 700,
    color: 'var(--warning, #b45309)',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  applied: {
    fontSize: '0.62rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  when: { fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  pager: { paddingTop: '0.1rem' },
};
