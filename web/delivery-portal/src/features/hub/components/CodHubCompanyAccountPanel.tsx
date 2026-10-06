import { useMemo, useState, type CSSProperties } from 'react';
import { Card } from '@/shared/ui';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import { isoIstDate, type TransferHistoryPreset } from '@hlm-dates/istReportPresets';
import type { CodHubLedger } from '../api/codApi';
import { codMoney, formatCodDate } from '../lib/codFormat';

type Pane = 'owed' | 'received' | 'remitted';
type SortDir = 'asc' | 'desc';
type ReceiptSort = 'date' | 'agent' | 'orders' | 'amount' | 'status';
type RemitSort = 'date' | 'amount' | 'reference';
type MoveSort = 'date' | 'what' | 'amount';

type Props = {
  data: CodHubLedger | null;
  loading?: boolean;
  error?: string | null;
  preset: TransferHistoryPreset;
  rangeFrom: string;
  rangeTo: string;
  onPresetChange: (preset: TransferHistoryPreset) => void;
  onRangeFromChange: (v: string) => void;
  onRangeToChange: (v: string) => void;
};

const LEDGER_DATE_OPTIONS: { id: TransferHistoryPreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7d' },
  { id: 'days30', label: '30d' },
  { id: 'month', label: 'This month' },
  { id: 'previousMonth', label: 'Prev month' },
  { id: 'q1', label: 'Q1' },
  { id: 'q2', label: 'Q2' },
  { id: 'q3', label: 'Q3' },
  { id: 'q4', label: 'Q4' },
  { id: 'firstHalf', label: 'HY1' },
  { id: 'secondHalf', label: 'HY2' },
  { id: 'annual', label: 'CY' },
  { id: 'financialYear', label: 'FY' },
  { id: 'custom', label: 'Custom' },
];

function cmpText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

function toggleDir(current: SortDir): SortDir {
  return current === 'asc' ? 'desc' : 'asc';
}

export function CodHubCompanyAccountPanel({
  data,
  loading,
  error,
  preset,
  rangeFrom,
  rangeTo,
  onPresetChange,
  onRangeFromChange,
  onRangeToChange,
}: Props) {
  const balance = Number(data?.balanceOwedToCompany ?? 0);
  const receivedAll = Number(data?.totalReceivedAllTime ?? 0);
  const remittedAll = Number(data?.totalRemittedAllTime ?? 0);
  const receivedRange = Number(data?.totalReceivedInRange ?? 0);
  const remittedRange = Number(data?.totalRemittedInRange ?? 0);
  const allTime = preset === 'all' || (!rangeFrom && !rangeTo);

  const receipts = data?.receipts ?? [];
  const remittances = data?.remittances ?? [];

  const [pane, setPane] = useState<Pane | null>(null);
  const [receiptSort, setReceiptSort] = useState<{ key: ReceiptSort; dir: SortDir }>({
    key: 'date',
    dir: 'asc',
  });
  const [remitSort, setRemitSort] = useState<{ key: RemitSort; dir: SortDir }>({
    key: 'date',
    dir: 'asc',
  });
  const [moveSort, setMoveSort] = useState<{ key: MoveSort; dir: SortDir }>({
    key: 'date',
    dir: 'asc',
  });

  const activePane: Pane = pane ?? (balance > 0 ? 'owed' : 'received');

  const receivedShown = allTime ? receivedAll : receivedRange;
  const remittedShown = allTime ? remittedAll : remittedRange;

  const movements = useMemo(() => {
    const rows: Array<{
      id: string;
      date: string;
      what: string;
      detail: string;
      amount: number;
      kind: 'in' | 'out';
    }> = [];
    for (const r of receipts) {
      rows.push({
        id: `in-${r.closeDayId}`,
        date: r.closeDate,
        what: r.agentName || 'Agent',
        detail: `${r.orderCount} order${r.orderCount === 1 ? '' : 's'}${
          r.fromAgentHandover ? ' · declared' : ''
        }`,
        amount: Number(r.receivedAmount ?? 0),
        kind: 'in',
      });
    }
    for (const r of remittances) {
      rows.push({
        id: `out-${r.remittanceId}`,
        date: r.remittanceDate,
        what: 'Sent to KoyaKart',
        detail: [r.reference, r.notes].filter(Boolean).join(' · ') || 'Deposit',
        amount: Number(r.amount ?? 0),
        kind: 'out',
      });
    }
    const dir = moveSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let c = 0;
      if (moveSort.key === 'date') c = cmpText(a.date, b.date);
      else if (moveSort.key === 'what') c = cmpText(a.what, b.what);
      else c = a.amount - b.amount;
      if (c === 0) c = cmpText(a.id, b.id);
      return c * dir;
    });
    return rows;
  }, [receipts, remittances, moveSort]);

  const sortedReceipts = useMemo(() => {
    const rows = [...receipts];
    const dir = receiptSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let c = 0;
      switch (receiptSort.key) {
        case 'date':
          c = cmpText(a.closeDate, b.closeDate);
          break;
        case 'agent':
          c = cmpText(a.agentName ?? '', b.agentName ?? '');
          break;
        case 'orders':
          c = a.orderCount - b.orderCount;
          break;
        case 'amount':
          c = Number(a.receivedAmount ?? 0) - Number(b.receivedAmount ?? 0);
          break;
        case 'status':
          c = cmpText(a.status, b.status);
          break;
        default:
          c = 0;
      }
      return c * dir;
    });
    return rows;
  }, [receipts, receiptSort]);

  const sortedRemittances = useMemo(() => {
    const rows = [...remittances];
    const dir = remitSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let c = 0;
      if (remitSort.key === 'date') c = cmpText(a.remittanceDate, b.remittanceDate);
      else if (remitSort.key === 'amount') c = Number(a.amount ?? 0) - Number(b.amount ?? 0);
      else c = cmpText(a.reference ?? '', b.reference ?? '');
      return c * dir;
    });
    return rows;
  }, [remittances, remitSort]);

  const rangeHint =
    allTime
      ? 'All time'
      : data?.from && data?.to
        ? `${formatCodDate(data.from)} → ${formatCodDate(data.to)}`
        : rangeFrom || rangeTo
          ? `${rangeFrom || '…'} → ${rangeTo || '…'}`
          : '';

  if (loading && !data) {
    return (
      <Card style={styles.card}>
        <p style={styles.title}>Company account (COD)</p>
        <p style={styles.muted}>Loading receipts…</p>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <p style={styles.title}>Company account (COD)</p>
      <p style={styles.lead}>
        Tap a tile for that list. Cash confirmed from agents is owed to KoyaKart until you remit it.
      </p>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.kpiRow}>
        <button
          type="button"
          style={activePane === 'owed' ? styles.kpiOnOwed : styles.kpiBtn}
          onClick={() => setPane('owed')}
        >
          <span style={styles.kpiLabel}>Owed to company</span>
          <strong style={{ ...styles.kpiValue, color: '#c2410c' }}>{codMoney(balance, true)}</strong>
          <span style={styles.kpiHint}>Still to remit · all time</span>
        </button>
        <button
          type="button"
          style={activePane === 'received' ? styles.kpiOn : styles.kpiBtn}
          onClick={() => setPane('received')}
        >
          <span style={styles.kpiLabel}>Received from agents</span>
          <strong style={styles.kpiValue}>{codMoney(receivedShown, true)}</strong>
          <span style={styles.kpiHint}>{allTime ? 'All time' : 'This period'}</span>
        </button>
        <button
          type="button"
          style={activePane === 'remitted' ? styles.kpiOn : styles.kpiBtn}
          onClick={() => setPane('remitted')}
        >
          <span style={styles.kpiLabel}>Remitted to company</span>
          <strong style={styles.kpiValue}>{codMoney(remittedShown, true)}</strong>
          <span style={styles.kpiHint}>{allTime ? 'All time' : 'This period'}</span>
        </button>
      </div>

      <DateRangePresetBar
        dense
        alwaysShowDateInputs
        preset={preset}
        from={rangeFrom}
        to={rangeTo}
        onPresetChange={onPresetChange}
        onFromChange={onRangeFromChange}
        onToChange={onRangeToChange}
        options={LEDGER_DATE_OPTIONS}
        maxDate={isoIstDate()}
        ariaLabel="Account period"
      />

      <div style={styles.sectionHead}>
        <h2 style={styles.sectionTitle}>
          {activePane === 'owed'
            ? `Balance movements (${movements.length})`
            : activePane === 'received'
              ? `Received from agents (${sortedReceipts.length})`
              : `Remitted to company (${sortedRemittances.length})`}
        </h2>
        {rangeHint ? <span style={styles.rangeHint}>{rangeHint}</span> : null}
      </div>
      <p style={styles.formulaHint}>
        {activePane === 'owed'
          ? `Owed ${codMoney(balance, true)} = received ${codMoney(receivedAll, true)} − remitted ${codMoney(remittedAll, true)}. Period: in ${codMoney(receivedRange, true)} · out ${codMoney(remittedRange, true)}.`
          : activePane === 'received'
            ? 'Hub confirmed these COD bags from riders. Click a column to sort. Oldest first by default.'
            : 'Deposits KoyaKart recorded from this hub. Click a column to sort. Oldest first by default.'}
      </p>

      {activePane === 'owed' ? (
        movements.length === 0 ? (
          <p style={styles.muted}>No receipts or remittances in this period.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <SortTh
                    label="Date"
                    active={moveSort.key === 'date'}
                    dir={moveSort.dir}
                    onClick={() =>
                      setMoveSort((p) => ({
                        key: 'date',
                        dir: p.key === 'date' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                  <SortTh
                    label="What"
                    active={moveSort.key === 'what'}
                    dir={moveSort.dir}
                    onClick={() =>
                      setMoveSort((p) => ({
                        key: 'what',
                        dir: p.key === 'what' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                  <SortTh
                    label="Amount"
                    align="right"
                    active={moveSort.key === 'amount'}
                    dir={moveSort.dir}
                    onClick={() =>
                      setMoveSort((p) => ({
                        key: 'amount',
                        dir: p.key === 'amount' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                </tr>
              </thead>
              <tbody>
                {movements.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{formatCodDate(row.date)}</td>
                    <td style={styles.td}>
                      <strong>{row.kind === 'in' ? 'From agent' : 'To company'}</strong>
                      <div style={styles.sub}>
                        {row.what}
                        {row.detail ? ` · ${row.detail}` : ''}
                      </div>
                    </td>
                    <td
                      style={{
                        ...styles.tdRight,
                        color: row.kind === 'out' ? '#15803d' : '#c2410c',
                      }}
                    >
                      {row.kind === 'out' ? '−' : '+'}
                      {codMoney(row.amount, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {activePane === 'received' ? (
        sortedReceipts.length === 0 ? (
          <p style={styles.muted}>No confirmed agent handovers in this range yet.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <SortTh
                    label="Date"
                    active={receiptSort.key === 'date'}
                    dir={receiptSort.dir}
                    onClick={() =>
                      setReceiptSort((p) => ({
                        key: 'date',
                        dir: p.key === 'date' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                  <SortTh
                    label="Agent"
                    active={receiptSort.key === 'agent'}
                    dir={receiptSort.dir}
                    onClick={() =>
                      setReceiptSort((p) => ({
                        key: 'agent',
                        dir: p.key === 'agent' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                  <SortTh
                    label="Orders"
                    align="right"
                    active={receiptSort.key === 'orders'}
                    dir={receiptSort.dir}
                    onClick={() =>
                      setReceiptSort((p) => ({
                        key: 'orders',
                        dir: p.key === 'orders' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                  <SortTh
                    label="You received"
                    align="right"
                    active={receiptSort.key === 'amount'}
                    dir={receiptSort.dir}
                    onClick={() =>
                      setReceiptSort((p) => ({
                        key: 'amount',
                        dir: p.key === 'amount' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                  <SortTh
                    label="Status"
                    active={receiptSort.key === 'status'}
                    dir={receiptSort.dir}
                    onClick={() =>
                      setReceiptSort((p) => ({
                        key: 'status',
                        dir: p.key === 'status' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                </tr>
              </thead>
              <tbody>
                {sortedReceipts.map((r) => (
                  <tr key={r.closeDayId}>
                    <td style={styles.td}>{formatCodDate(r.closeDate)}</td>
                    <td style={styles.td}>{r.agentName}</td>
                    <td style={styles.tdRight}>{r.orderCount}</td>
                    <td style={styles.tdRight}>{codMoney(r.receivedAmount, true)}</td>
                    <td style={styles.td}>
                      {r.status === 'MATCHED' ? 'Matched' : 'Discrepancy'}
                      {r.fromAgentHandover ? ' · declared' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {activePane === 'remitted' ? (
        sortedRemittances.length === 0 ? (
          <p style={styles.muted}>No company deposits recorded for this hub in this period.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <SortTh
                    label="Date"
                    active={remitSort.key === 'date'}
                    dir={remitSort.dir}
                    onClick={() =>
                      setRemitSort((p) => ({
                        key: 'date',
                        dir: p.key === 'date' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                  <SortTh
                    label="Amount"
                    align="right"
                    active={remitSort.key === 'amount'}
                    dir={remitSort.dir}
                    onClick={() =>
                      setRemitSort((p) => ({
                        key: 'amount',
                        dir: p.key === 'amount' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                  <SortTh
                    label="Reference"
                    active={remitSort.key === 'reference'}
                    dir={remitSort.dir}
                    onClick={() =>
                      setRemitSort((p) => ({
                        key: 'reference',
                        dir: p.key === 'reference' ? toggleDir(p.dir) : 'asc',
                      }))
                    }
                  />
                </tr>
              </thead>
              <tbody>
                {sortedRemittances.map((r) => (
                  <tr key={r.remittanceId}>
                    <td style={styles.td}>{formatCodDate(r.remittanceDate)}</td>
                    <td style={styles.tdRight}>{codMoney(r.amount, true)}</td>
                    <td style={styles.tdMuted}>
                      <div>{r.reference || '—'}</div>
                      {r.notes ? <div style={styles.sub}>{r.notes}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </Card>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <th style={{ ...styles.th, textAlign: align, color: active ? 'var(--text)' : undefined }}>
      <button type="button" style={{ ...styles.sortBtn, textAlign: align }} onClick={onClick}>
        {label}
        <span style={{ opacity: active ? 0.9 : 0.35 }}>{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
      </button>
    </th>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.4rem', padding: '0.55rem 0.65rem' },
  title: { margin: 0, fontWeight: 800, fontSize: '0.92rem' },
  lead: { margin: 0, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 },
  error: { margin: 0, fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 650 },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 8.8rem), 1fr))',
    gap: '0.4rem',
  },
  kpiBtn: {
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    padding: '0.4rem 0.5rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
  },
  kpiOn: {
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    padding: '0.4rem 0.5rem',
    borderRadius: 8,
    border: '1.5px solid var(--accent)',
    background: 'var(--accent-soft)',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
  },
  kpiOnOwed: {
    display: 'grid',
    gap: '0.06rem',
    alignContent: 'start',
    padding: '0.4rem 0.5rem',
    borderRadius: 8,
    border: '1.5px solid #fdba74',
    background: '#fff7ed',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
  },
  kpiLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  kpiValue: { fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums', fontWeight: 800 },
  kpiHint: { fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 },
  sectionHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  sectionTitle: { margin: 0, fontSize: '0.78rem', fontWeight: 800 },
  rangeHint: { fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 },
  formulaHint: {
    margin: 0,
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    lineHeight: 1.3,
    fontWeight: 600,
  },
  muted: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 },
  tableWrap: { overflowX: 'auto', marginTop: '0.05rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' },
  th: {
    textAlign: 'left',
    padding: 0,
    borderBottom: '1px solid var(--border)',
    fontWeight: 750,
    color: 'var(--text-muted)',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
  },
  sortBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.12rem',
    width: '100%',
    margin: 0,
    padding: '0.32rem 0.4rem',
    border: 'none',
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    fontWeight: 750,
    cursor: 'pointer',
    minHeight: 36,
  },
  td: { padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border-subtle, var(--border))', verticalAlign: 'top' },
  tdRight: {
    padding: '0.32rem 0.4rem',
    borderBottom: '1px solid var(--border-subtle, var(--border))',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'top',
  },
  tdMuted: {
    padding: '0.32rem 0.4rem',
    borderBottom: '1px solid var(--border-subtle, var(--border))',
    color: 'var(--text-muted)',
    verticalAlign: 'top',
  },
  sub: { color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 500 },
};
