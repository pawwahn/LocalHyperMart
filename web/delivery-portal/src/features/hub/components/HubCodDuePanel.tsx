import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import {
  DEFAULT_REPORT_DATE_PRESET,
  hubCodPaymentPeriodKind,
  isoIstDate,
  rangeForReportPreset,
  type ReportDatePreset,
} from '@hlm-dates/istReportPresets';
import { previewHubCodDue, type HubCodPreview } from '../api/hubPaymentRequestApi';
import { formatIsoDateRange } from '../lib/codFormat';

type Props = {
  token: string;
  preset?: ReportDatePreset;
  from?: string;
  to?: string;
};

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function sumLines(lines: HubCodPreview['codLines']): number {
  return (lines ?? []).reduce((s, l) => s + Number(l.amount || 0), 0);
}

export function HubCodDuePanel({ token, preset: presetProp, from: fromProp, to: toProp }: Props) {
  const controlled = presetProp != null && fromProp != null && toProp != null;
  const initial = rangeForReportPreset(DEFAULT_REPORT_DATE_PRESET);
  const [localPreset, setLocalPreset] = useState<ReportDatePreset>(DEFAULT_REPORT_DATE_PRESET);
  const [localFrom, setLocalFrom] = useState(initial.from);
  const [localTo, setLocalTo] = useState(initial.to);
  const preset = controlled ? presetProp : localPreset;
  const from = controlled ? fromProp : localFrom;
  const to = controlled ? toProp : localTo;
  const [preview, setPreview] = useState<HubCodPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linesOpen, setLinesOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void previewHubCodDue(token, {
      periodKind: hubCodPaymentPeriodKind(preset),
      periodStart: from,
      periodEnd: hubCodPaymentPeriodKind(preset) === 'DAILY' ? from : to,
    })
      .then((next) => {
        if (cancelled) return;
        setPreview(next);
        setLinesOpen(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreview(null);
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load COD for this period');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, preset, from, to]);

  const reconcile = useMemo(() => {
    if (!preview) return null;
    const lines = preview.codLines ?? [];
    const lineSum = sumLines(lines);
    const total = Number(preview.totalAmount);
    const balance = Number(preview.hubBalanceOwedToCompany);
    return {
      lines,
      lineSum,
      total,
      balance,
      linesMatch: Math.abs(lineSum - total) < 0.005,
      withinBalance: total <= balance + 0.005,
    };
  }, [preview]);

  return (
    <div style={styles.root}>
      <div style={styles.headRow}>
        <h2 style={styles.title}>COD due</h2>
        {preview ? <span style={styles.rangeChip}>{formatIsoDateRange(preview.periodStart, preview.periodEnd)}</span> : null}
      </div>
      {controlled ? null : (
        <DateRangePresetBar
          preset={preset}
          from={from}
          to={to}
          onPresetChange={setLocalPreset}
          onFromChange={setLocalFrom}
          onToChange={setLocalTo}
          maxDate={isoIstDate()}
          alwaysShowDateInputs
          dense
          toDisabled={hubCodPaymentPeriodKind(preset) === 'DAILY'}
          ariaLabel="COD period"
        />
      )}
      {loading ? <p style={styles.muted}>Loading…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {preview && reconcile && !loading ? (
        <>
          <div style={styles.statGrid}>
            <div style={reconcile.total > 0 ? styles.statOut : styles.statQuiet}>
              <span style={styles.statLabel}>You pay KoyaKart</span>
              <strong style={reconcile.total > 0 ? styles.statAmtOut : styles.statAmt}>{money(reconcile.total)}</strong>
              <span style={styles.statMeta}>
                {formatIsoDateRange(preview.periodStart, preview.periodEnd)} · {preview.orderCount} order
                {preview.orderCount === 1 ? '' : 's'} · not billed yet
              </span>
            </div>
          </div>
          {!reconcile.linesMatch ? (
            <p style={styles.error}>
              Lines {money(reconcile.lineSum)} · bill {money(reconcile.total)}
            </p>
          ) : null}
          {!reconcile.withinBalance ? (
            <p style={styles.error}>Over hub balance by {money(reconcile.total - reconcile.balance)}</p>
          ) : null}
          {reconcile.lines.length > 0 ? (
            <div style={styles.linesShell}>
              <button type="button" style={styles.toggle} onClick={() => setLinesOpen((v) => !v)} aria-expanded={linesOpen}>
                <span>{linesOpen ? '▾' : '▸'} Orders</span>
                <span>{reconcile.lines.length}</span>
              </button>
              {linesOpen ? (
                <div style={styles.table}>
                  <div style={styles.tableHead}>
                    <span>Order</span>
                    <span>Close</span>
                    <span style={styles.amtCol}>Amount</span>
                  </div>
                  {reconcile.lines.map((l) => (
                    <div key={l.orderId} style={styles.tableRow}>
                      <span style={styles.orderCell}>{l.orderNumber?.trim() || l.orderId.slice(0, 8)}</span>
                      <span style={styles.dateCell}>{l.closeDate || '—'}</span>
                      <strong style={styles.amtCol}>{money(l.amount)}</strong>
                    </div>
                  ))}
                  <div style={styles.totalRow}>
                    <span>Line total</span>
                    <span />
                    <strong style={styles.amtCol}>{money(reconcile.lineSum)}</strong>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p style={styles.muted}>
              No COD is waiting in this range. Cash the hub already sent, or cash already on a bill, is not listed here.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.4rem' },
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '0.92rem', fontWeight: 800 },
  rangeChip: {
    fontSize: '0.68rem',
    fontWeight: 750,
    color: '#9a3412',
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: 999,
    padding: '0.15rem 0.45rem',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(7.2rem, 1fr))',
    gap: '0.35rem',
  },
  statBill: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.4rem 0.5rem',
    borderRadius: 10,
    border: '1px solid #86efac',
    background: '#f0fdf4',
  },
  statOut: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.4rem 0.5rem',
    borderRadius: 10,
    border: '1px solid #fdba74',
    background: '#fff7ed',
  },
  statQuiet: {
    display: 'grid',
    gap: '0.05rem',
    padding: '0.4rem 0.5rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  statLabel: {
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  statAmt: { fontSize: '1.05rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' },
  statAmtBill: { fontSize: '1.05rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#15803d' },
  statAmtOut: { fontSize: '1.05rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#c2410c' },
  statMeta: { fontSize: '0.68rem', fontWeight: 650, color: 'var(--text-muted)' },
  muted: { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 650 },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 700 },
  linesShell: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  toggle: {
    border: 'none',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontFamily: 'inherit',
    fontSize: '0.72rem',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.35rem 0.5rem',
    color: 'var(--text)',
    width: '100%',
    minHeight: 36,
  },
  table: { display: 'grid' },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) 6.2rem auto',
    gap: '0.4rem',
    padding: '0.28rem 0.5rem',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) 6.2rem auto',
    gap: '0.4rem',
    alignItems: 'center',
    padding: '0.32rem 0.5rem',
    borderTop: '1px solid var(--border)',
    fontSize: '0.75rem',
  },
  orderCell: { fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dateCell: { fontSize: '0.7rem', fontWeight: 650, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },
  amtCol: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  totalRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) 6.2rem auto',
    gap: '0.4rem',
    alignItems: 'center',
    padding: '0.35rem 0.5rem',
    borderTop: '1px solid var(--border)',
    fontSize: '0.75rem',
    fontWeight: 800,
    background: 'var(--bg-elevated)',
  },
};
