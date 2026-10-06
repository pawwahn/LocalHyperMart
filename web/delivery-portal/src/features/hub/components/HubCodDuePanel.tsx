import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { DateRangePresetBar } from '@hlm-dates/DateRangePresetBar';
import {
  hubCodPaymentPeriodKind,
  isoIstDate,
  rangeForReportPreset,
  type ReportDatePreset,
} from '@hlm-dates/istReportPresets';
import { previewHubCodDue, type HubCodPreview } from '../api/hubPaymentRequestApi';
import { formatIsoDateRange } from '../lib/codFormat';

type Props = { token: string };

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function sumLines(lines: HubCodPreview['codLines']): number {
  return (lines ?? []).reduce((s, l) => s + Number(l.amount || 0), 0);
}

export function HubCodDuePanel({ token }: Props) {
  const initial = rangeForReportPreset('month');
  const [preset, setPreset] = useState<ReportDatePreset>('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
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
      <h2 style={styles.title}>COD due this term</h2>
      <p style={styles.muted}>Same IST period as KoyaKart Accounts — what you would owe if a statement is issued for these dates.</p>
      <DateRangePresetBar
        preset={preset}
        from={from}
        to={to}
        onPresetChange={setPreset}
        onFromChange={setFrom}
        onToChange={setTo}
        maxDate={isoIstDate()}
        alwaysShowDateInputs
        stackDateInputs
        toDisabled={hubCodPaymentPeriodKind(preset) === 'DAILY'}
        ariaLabel="COD period"
      />
      {loading ? <p style={styles.muted}>Loading period…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {preview && reconcile && !loading ? (
        <>
          <p style={styles.hero}>{money(preview.totalAmount)}</p>
          <p style={styles.meta}>
            {formatIsoDateRange(preview.periodStart, preview.periodEnd)} · {preview.orderCount} order
            {preview.orderCount === 1 ? '' : 's'} · hub balance {money(preview.hubBalanceOwedToCompany)}
          </p>
          {preview.warning ? <p style={styles.warn}>{preview.warning}</p> : null}
          {!reconcile.linesMatch ? (
            <p style={styles.error}>
              Line amounts ({money(reconcile.lineSum)}) must match period total ({money(reconcile.total)}).
            </p>
          ) : null}
          {!reconcile.withinBalance ? (
            <p style={styles.error}>
              Period total exceeds hub COD balance by {money(reconcile.total - reconcile.balance)} — narrow the dates.
            </p>
          ) : reconcile.total === reconcile.balance && reconcile.total > 0 ? (
            <p style={styles.ok}>Totals match hub ledger balance to the paisa.</p>
          ) : reconcile.total > 0 ? (
            <p style={styles.muted}>
              Partial period: {money(reconcile.balance - reconcile.total)} stays on hub balance if only this term is billed.
            </p>
          ) : (
            <p style={styles.muted}>No remittable COD in this period.</p>
          )}
          {reconcile.lines.length > 0 ? (
            <div style={styles.linesShell}>
              <button type="button" style={styles.toggle} onClick={() => setLinesOpen((v) => !v)} aria-expanded={linesOpen}>
                {linesOpen ? '▾' : '▸'} Orders ({reconcile.lines.length})
              </button>
              {linesOpen ? (
                <ul style={styles.list}>
                  {reconcile.lines.map((l) => (
                    <li key={l.orderId} style={styles.item}>
                      <span>
                        {l.orderNumber?.trim() || l.orderId.slice(0, 8)}
                        {l.closeDate ? ` · ${l.closeDate}` : ''}
                      </span>
                      <strong>{money(l.amount)}</strong>
                    </li>
                  ))}
                  <li style={styles.totalRow}>
                    <span>Line total</span>
                    <strong>{money(reconcile.lineSum)}</strong>
                  </li>
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.4rem' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.35 },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 650 },
  warn: { margin: 0, fontSize: '0.75rem', fontWeight: 650, color: '#b45309' },
  ok: { margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#15803d' },
  hero: { margin: 0, fontSize: '1.35rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#c2410c' },
  meta: { margin: 0, fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)' },
  linesShell: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
  },
  toggle: {
    border: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: '0.75rem',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'left',
    padding: '0.4rem 0.5rem',
    color: 'var(--text)',
    width: '100%',
    minHeight: 44,
  },
  list: {
    margin: 0,
    padding: '0 0.5rem 0.4rem',
    listStyle: 'none',
    display: 'grid',
    gap: '0.22rem',
    maxHeight: 'min(16rem, 42vh)',
    overflowY: 'auto',
    fontSize: '0.75rem',
  },
  item: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', color: 'var(--text-muted)' },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    paddingTop: '0.3rem',
    borderTop: '1px solid var(--border)',
    fontWeight: 800,
    color: 'var(--text)',
  },
};
