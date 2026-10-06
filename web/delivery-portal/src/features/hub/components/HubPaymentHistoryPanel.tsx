import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';

import { ApiError } from '@/shared/api/http';

import { Button } from '@/shared/ui';

import { fetchHubPaymentSubmissions, type HubPaymentSubmission } from '../api/hubPaymentApi';
import { HubPendingPaymentEditDialog } from './HubPendingPaymentEditDialog';

import { downloadHubPaymentReceiptHtml, fetchHubPaymentReceipt } from '../api/hubPaymentReceipt';

import { formatIsoDateRange } from '../lib/codFormat';

import {
  rangeForTransferHistoryPreset,
  TRANSFER_HISTORY_PRESET_OPTIONS,
  type TransferHistoryPreset,
} from '@hlm-dates/istReportPresets';

type Props = {
  token: string;
  refreshKey?: number;
};

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPayDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
}

function lineLabel(type: string): string {
  return type === 'FRANCHISE_FEE' ? 'Franchise' : 'COD';
}

function submissionPayDateIso(row: HubPaymentSubmission): string {
  if (row.paymentDate) return row.paymentDate.slice(0, 10);
  if (row.submittedAt) return row.submittedAt.slice(0, 10);
  return '';
}

function inRange(row: HubPaymentSubmission, from: string, to: string): boolean {
  const iso = submissionPayDateIso(row);
  if (!iso) return false;
  return iso >= from && iso <= to;
}

function statusStyle(status: string): CSSProperties {
  if (status === 'VERIFIED') {
    return { background: '#ecfdf5', color: '#15803d', border: '1px solid #bbf7d0' };
  }
  if (status === 'REJECTED') {
    return { background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid transparent' };
  }
  return { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
}

function shortStatus(status: string, statusLabel: string): string {
  if (status === 'VERIFIED') return 'Confirmed';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'PENDING_VERIFICATION') return 'Pending';
  return statusLabel;
}

function PaymentHistoryRow({
  row,
  token,
  showSelect,
  selected,
  onToggleSelect,
  onEdit,
}: {
  row: HubPaymentSubmission;
  token: string;
  showSelect: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
}) {
  const [billBusy, setBillBusy] = useState(false);
  const canSelect = row.status === 'VERIFIED';
  const canEdit = row.status === 'REJECTED' || (row.status === 'PENDING_VERIFICATION' && row.editable !== false);
  const note = row.hubNotes?.trim() ?? '';
  const rejectWhy = row.status === 'REJECTED' ? row.adminNotes?.trim() ?? '' : '';

  return (
    <tr>
      <td style={styles.tdCheck}>
        {showSelect && canSelect ? (
          <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label="Select for download" />
        ) : null}
      </td>
      <td style={styles.td}>{row.paymentDate ? formatPayDate(row.paymentDate) : '—'}</td>
      <td style={styles.td}>{formatWhen(row.submittedAt)}</td>
      <td style={styles.tdNum}>{money(row.totalAmount)}</td>
      <td style={styles.tdLines}>
        {row.lines.map((l) => (
          <div key={l.lineId}>
            {lineLabel(l.lineType)} {money(l.amount)}
            {l.franchiseLabel ? <span style={styles.lineSub}> · {l.franchiseLabel}</span> : null}
          </div>
        ))}
      </td>
      <td style={styles.tdMono}>{row.paymentReference}</td>
      <td style={styles.td}>
        <span style={{ ...styles.badge, ...statusStyle(row.status) }} title={row.statusLabel}>
          {shortStatus(row.status, row.statusLabel)}
        </span>
      </td>
      <td style={styles.td}>
        {row.status === 'VERIFIED' ? formatWhen(row.verifiedAt) : null}
        {row.status === 'REJECTED' ? formatWhen(row.rejectedAt) : null}
        {row.status === 'PENDING_VERIFICATION' ? '—' : null}
      </td>
      <td style={styles.tdNote} title={[note, rejectWhy ? `Rejected: ${rejectWhy}` : ''].filter(Boolean).join(' · ') || undefined}>
        {note || '—'}
        {rejectWhy ? <div style={styles.rejectWhy}>Rejected: {rejectWhy}</div> : null}
      </td>
      <td style={styles.tdAction}>
        {canEdit ? (
          <button type="button" style={styles.billBtn} onClick={onEdit}>
            Edit
          </button>
        ) : null}
        {row.status === 'VERIFIED' ? (
          <button
            type="button"
            style={styles.billBtn}
            disabled={billBusy}
            onClick={() => {
              void (async () => {
                setBillBusy(true);
                try {
                  const receipt = await fetchHubPaymentReceipt(token, row.submissionId);
                  downloadHubPaymentReceiptHtml(receipt);
                } catch {
                  /* bulk toolbar shows errors; row stays silent */
                } finally {
                  setBillBusy(false);
                }
              })();
            }}
          >
            {billBusy ? '…' : 'Bill'}
          </button>
        ) : null}
        {!canEdit && row.status !== 'VERIFIED' ? '—' : null}
      </td>
    </tr>
  );
}

export function HubPaymentHistoryPanel({ token, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<HubPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<TransferHistoryPreset>('financialYear');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<HubPaymentSubmission | null>(null);

  const range = useMemo(() => rangeForTransferHistoryPreset(preset), [preset]);

  const filtered = useMemo(() => {
    if (!range) return rows;
    return rows.filter((r) => inRange(r, range.from, range.to));
  }, [rows, range]);

  const verifiedFiltered = useMemo(() => filtered.filter((r) => r.status === 'VERIFIED'), [filtered]);

  const rangeLabel = range ? formatIsoDateRange(range.from, range.to) : 'All time (IST)';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchHubPaymentSubmissions(token));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load payment history');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setSelected(new Set());
    setBulkNotice(null);
  }, [preset, refreshKey]);

  const allVerifiedSelected =
    verifiedFiltered.length > 0 && verifiedFiltered.every((r) => selected.has(r.submissionId));

  async function downloadBills(ids: string[]) {
    if (ids.length === 0) return;
    setBulkBusy(true);
    setBulkNotice(null);
    setError(null);
    let ok = 0;
    try {
      for (const id of ids) {
        const receipt = await fetchHubPaymentReceipt(token, id);
        downloadHubPaymentReceiptHtml(receipt);
        ok += 1;
        await new Promise((r) => setTimeout(r, 450));
      }
      setBulkNotice(`Downloaded ${ok} bill${ok === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Bulk download failed');
    } finally {
      setBulkBusy(false);
    }
  }

  const selectedVerifiedIds = verifiedFiltered.filter((r) => selected.has(r.submissionId)).map((r) => r.submissionId);
  const showRowSelect = verifiedFiltered.length > 0;

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <div style={styles.presets}>
          {TRANSFER_HISTORY_PRESET_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              style={preset === id ? styles.presetOn : styles.presetOff}
              onClick={() => setPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={styles.toolbarMeta}>
          <div style={styles.toolbarSummaryRow}>
            <p style={styles.rangeLine}>
              <strong>{rangeLabel}</strong>
              {' · '}
              {filtered.length} record{filtered.length === 1 ? '' : 's'}
              {verifiedFiltered.length > 0 ? ` · ${verifiedFiltered.length} confirmed` : ''}
            </p>
            <div style={styles.toolbarActions}>
            {verifiedFiltered.length > 0 ? (
              <label style={styles.selectAll}>
                <input
                  type="checkbox"
                  checked={allVerifiedSelected}
                  onChange={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (allVerifiedSelected) {
                        for (const r of verifiedFiltered) next.delete(r.submissionId);
                      } else {
                        for (const r of verifiedFiltered) next.add(r.submissionId);
                      }
                      return next;
                    });
                  }}
                />
                Select confirmed
              </label>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={bulkBusy || verifiedFiltered.length === 0}
              onClick={() => void downloadBills(verifiedFiltered.map((r) => r.submissionId))}
            >
              {bulkBusy ? 'Downloading…' : `Download all bills (${verifiedFiltered.length})`}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={bulkBusy || selectedVerifiedIds.length === 0}
              onClick={() => void downloadBills(selectedVerifiedIds)}
            >
              Download selected ({selectedVerifiedIds.length})
            </Button>
            </div>
          </div>
          <table style={styles.helpTable} aria-label="Column meanings">
            <tbody>
              <tr>
                <th scope="row" style={styles.helpTh}>
                  Tenure filter
                </th>
                <td style={styles.helpTd}>Paid date (IST), else submission day</td>
                <th scope="row" style={styles.helpTh}>
                  Paid
                </th>
                <td style={styles.helpTd}>Bank transfer date you entered</td>
              </tr>
              <tr>
                <th scope="row" style={styles.helpTh}>
                  Submitted
                </th>
                <td style={styles.helpTd}>When UTR was saved</td>
                <th scope="row" style={styles.helpTh}>
                  Confirmed
                </th>
                <td style={styles.helpTd}>When KoyaKart verified credit</td>
              </tr>
              <tr>
                <th scope="row" style={styles.helpTh}>
                  Bills
                </th>
                <td style={styles.helpTd} colSpan={3}>
                  COD / franchise period covered by this transfer
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {bulkNotice ? <p style={styles.notice}>{bulkNotice}</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {loading && rows.length === 0 ? <p style={styles.muted}>Loading…</p> : null}
      {!loading && filtered.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon} aria-hidden>
            ↗
          </span>
          <p style={styles.emptyTitle}>No payments in this period</p>
          <p style={styles.muted}>Try another tenure or pay KoyaKart from Pay bills.</p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <colgroup>
              <col style={{ width: '2.25rem' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '11%' }} />
              <col />
              <col style={{ width: '3.6rem' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={styles.thCheck} aria-label="Select" />
                <th style={styles.th}>Paid</th>
                <th style={styles.th}>Submitted</th>
                <th style={{ ...styles.th, ...styles.thNum }}>Amount</th>
                <th style={styles.th}>Bills</th>
                <th style={styles.th}>UTR / ref</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Confirmed</th>
                <th style={styles.th}>Your note</th>
                <th style={styles.thAction}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <PaymentHistoryRow
                  key={row.submissionId}
                  row={row}
                  token={token}
                  showSelect={showRowSelect}
                  selected={selected.has(row.submissionId)}
                  onToggleSelect={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.submissionId)) next.delete(row.submissionId);
                      else next.add(row.submissionId);
                      return next;
                    });
                  }}
                  onEdit={() => setEditing(row)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <HubPendingPaymentEditDialog
        open={editing != null}
        token={token}
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setBulkNotice(
            editing?.status === 'REJECTED'
              ? 'Sent again for KoyaKart confirmation.'
              : 'Submitted. This payment can no longer be edited.',
          );
          void load();
        }}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.45rem', width: '100%', minWidth: 0 },
  toolbar: {
    display: 'grid',
    gap: '0.4rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    width: '100%',
    minWidth: 0,
  },
  presets: { display: 'flex', flexWrap: 'wrap', gap: '0.28rem' },
  presetOff: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    borderRadius: 999,
    padding: '0.2rem 0.5rem',
    fontSize: '0.68rem',
    fontWeight: 650,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  presetOn: {
    border: '1.5px solid var(--accent)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    borderRadius: 999,
    padding: '0.2rem 0.5rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  toolbarMeta: { display: 'grid', gap: '0.35rem', minWidth: 0 },
  toolbarSummaryRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.35rem 0.75rem',
  },
  rangeLine: { margin: 0, fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-muted)', flex: '1 1 12rem' },
  helpTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.66rem',
    lineHeight: 1.35,
    borderRadius: 8,
    border: '1px solid color-mix(in srgb, var(--border) 85%, transparent)',
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  helpTh: {
    textAlign: 'left',
    padding: '0.28rem 0.45rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    width: '1%',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
    verticalAlign: 'top',
  },
  helpTd: {
    padding: '0.28rem 0.45rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
    verticalAlign: 'top',
  },
  toolbarActions: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', flexShrink: 0 },
  selectAll: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  notice: { margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#15803d' },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.4 },
  error: { margin: 0, fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 650 },
  empty: {
    textAlign: 'center',
    padding: '1.25rem 0.75rem',
    borderRadius: 14,
    border: '1px dashed var(--border)',
    background: 'var(--bg-elevated)',
  },
  emptyIcon: { fontSize: '1.5rem', opacity: 0.45 },
  emptyTitle: { margin: '0.35rem 0 0.15rem', fontWeight: 800, fontSize: '0.9rem' },
  lineSub: { fontSize: '0.65rem', color: 'var(--text-muted)' },
  billBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 6,
    padding: '0.22rem 0.45rem',
    fontSize: '0.65rem',
    fontWeight: 800,
    cursor: 'pointer',
    color: 'var(--text)',
    fontFamily: 'inherit',
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.62rem',
    fontWeight: 800,
    padding: '0.22rem 0.5rem',
    borderRadius: 999,
    lineHeight: 1.2,
    maxWidth: '100%',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    width: '100%',
    minWidth: 0,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', tableLayout: 'fixed' },
  th: {
    textAlign: 'left',
    padding: '0.35rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 800,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    background: 'var(--bg)',
  },
  thNum: { textAlign: 'right' },
  thCheck: { width: 28, padding: '0.35rem 0.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  thAction: {
    textAlign: 'center',
    padding: '0.35rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 800,
    color: 'var(--text-muted)',
    width: 58,
    background: 'var(--bg)',
  },
  td: {
    padding: '0.35rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  tdCheck: { padding: '0.35rem 0.25rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' },
  tdNum: {
    padding: '0.35rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  tdLines: {
    padding: '0.35rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    verticalAlign: 'top',
    minWidth: 120,
    lineHeight: 1.35,
  },
  tdMono: {
    padding: '0.35rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.68rem',
    verticalAlign: 'top',
    wordBreak: 'break-all',
  },
  tdNote: {
    padding: '0.35rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    verticalAlign: 'top',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    lineHeight: 1.35,
  },
  rejectWhy: {
    marginTop: '0.15rem',
    fontStyle: 'normal',
    fontSize: '0.65rem',
    fontWeight: 750,
    color: 'var(--danger)',
    lineHeight: 1.3,
  },
  tdAction: { padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'top' },
};
