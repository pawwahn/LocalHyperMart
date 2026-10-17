import { useEffect, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { previewHubFranchiseDue, type HubFranchiseDuePreview } from '../api/hubPaymentRequestApi';
import { formatIsoDateRange } from '../lib/codFormat';

type Props = { token: string; from?: string; to?: string; year?: number; month?: number };

type MonthDue = { year: number; month: number; preview: HubFranchiseDuePreview };

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const month = i + 1;
  const name = new Date(2020, i, 15).toLocaleDateString('en-IN', { month: 'long' });
  return { month, name };
});

function formatBillingMonth(year: number, month: number): string {
  if (month < 1 || month > 12) return '—';
  const d = new Date(`${year}-${String(month).padStart(2, '0')}-01T12:00:00+05:30`);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function monthsInRange(from: string, to: string): { year: number; month: number }[] {
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endYear = Number(to.slice(0, 4));
  const endMonth = Number(to.slice(5, 7));
  if (!year || !month || !endYear || !endMonth) return [];
  const months: { year: number; month: number }[] = [];
  while ((year < endYear || (year === endYear && month <= endMonth)) && months.length < 18) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months.reverse();
}

export function HubFranchiseDuePanel({ token, from, to, year: yearProp, month: monthProp }: Props) {
  const ranged = /^\d{4}-\d{2}/.test(from ?? '') && /^\d{4}-\d{2}/.test(to ?? '');
  const controlled = !ranged && yearProp != null && monthProp != null;
  const t = todayIso();
  const [localYear, setLocalYear] = useState(() => Number(t.slice(0, 4)));
  const [localMonth, setLocalMonth] = useState(() => Number(t.slice(5, 7)));
  const year = controlled ? yearProp : localYear;
  const month = controlled ? monthProp : localMonth;
  const [rows, setRows] = useState<MonthDue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = ranged
    ? monthsInRange(from!, to!)
    : month >= 1 && month <= 12 && year >= 2020
      ? [{ year, month }]
      : [];

  useEffect(() => {
    if (targets.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all(targets.map((item) => previewHubFranchiseDue(token, item.year, item.month).then((preview) => ({ ...item, preview }))))
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load franchise for this month');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, from, to, year, month]);

  const visible = rows.filter((row) => row.preview.enabled);
  const beforeBilling = rows.find((row) => !row.preview.enabled && row.preview.label?.trim());

  return (
    <div style={styles.root}>
      <h2 style={styles.title}>Franchise due</h2>
      <p style={styles.muted}>
        {ranged && from && to
          ? `Each month from ${formatIsoDateRange(from, to)}.`
          : 'Calendar month — same window KoyaKart uses when issuing a franchise bill.'}
      </p>
      {ranged || controlled ? null : (
        <div style={styles.row2}>
          <label style={styles.field}>
            Year
            <input
              type="number"
              min={2020}
              max={2100}
              value={year}
              onChange={(e) => setLocalYear(Number(e.target.value))}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            Month
            <select value={month} onChange={(e) => setLocalMonth(Number(e.target.value))} style={styles.input}>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.month} — {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {loading ? <p style={styles.muted}>Checking franchise…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {!loading && visible.length > 0 ? (
        <div style={styles.list}>
          {visible.map((row) => {
            const due = !row.preview.alreadyCollected && Number(row.preview.amount) > 0;
            return (
              <div key={`${row.year}-${row.month}`} style={styles.dueRow}>
                <div style={styles.dueCopy}>
                  <strong>{formatBillingMonth(row.year, row.month)}</strong>
                  <span style={styles.muted}>
                    {row.preview.periodStart && row.preview.periodEnd
                      ? formatIsoDateRange(row.preview.periodStart, row.preview.periodEnd)
                      : ''}
                    {row.preview.label ? ` · ${row.preview.label}` : ''}
                  </span>
                </div>
                <strong style={due ? styles.hero : styles.heroMuted}>{money(row.preview.amount)}</strong>
                <span style={due ? styles.duePill : styles.ok}>
                  {row.preview.alreadyCollected ? 'Collected' : due ? 'Due' : 'Nothing due'}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
      {!loading && visible.length > 0 && beforeBilling ? (
        <p style={styles.muted}>{beforeBilling.preview.label}. Earlier months in this range have no franchise.</p>
      ) : null}
      {!loading && visible.length === 0 && !error && beforeBilling ? (
        <p style={styles.warn}>{beforeBilling.preview.label}</p>
      ) : null}
      {!loading && visible.length === 0 && !error && !beforeBilling && rows.length > 0 ? (
        <p style={styles.warn}>Franchise fee is not enrolled for this hub — nothing is due.</p>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: 'grid', gap: '0.4rem' },
  title: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.35 },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 650 },
  warn: { margin: 0, fontSize: '0.78rem', fontWeight: 650, color: 'var(--danger)' },
  ok: { margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#15803d' },
  month: { margin: 0, fontSize: '1rem', fontWeight: 900 },
  hero: { margin: 0, fontSize: '0.95rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#c2410c', textAlign: 'right' },
  heroMuted: { margin: 0, fontSize: '0.95rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', textAlign: 'right' },
  list: { display: 'grid', gap: '0.35rem' },
  dueRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    gap: '0.45rem',
    alignItems: 'center',
    padding: '0.4rem 0.5rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  dueCopy: { display: 'grid', gap: '0.05rem', minWidth: 0 },
  duePill: { fontSize: '0.68rem', fontWeight: 800, color: '#c2410c' },
  meta: { margin: 0, fontSize: '0.75rem', fontWeight: 650, color: 'var(--text-muted)' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' },
  field: { display: 'grid', gap: '0.2rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' },
  input: {
    padding: '0.4rem 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    minHeight: 44,
    boxSizing: 'border-box',
  },
};
