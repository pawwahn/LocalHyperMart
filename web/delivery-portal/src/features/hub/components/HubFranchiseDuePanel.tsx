import { useEffect, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import { previewHubFranchiseDue, type HubFranchiseDuePreview } from '../api/hubPaymentRequestApi';
import { formatIsoDateRange } from '../lib/codFormat';

type Props = { token: string };

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

export function HubFranchiseDuePanel({ token }: Props) {
  const t = todayIso();
  const [year, setYear] = useState(() => Number(t.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(t.slice(5, 7)));
  const [preview, setPreview] = useState<HubFranchiseDuePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (month < 1 || month > 12 || year < 2020) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void previewHubFranchiseDue(token, year, month)
      .then((next) => {
        if (!cancelled) setPreview(next);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreview(null);
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load franchise for this month');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, year, month]);

  return (
    <div style={styles.root}>
      <h2 style={styles.title}>Franchise due this term</h2>
      <p style={styles.muted}>Calendar month — same window KoyaKart uses when issuing a franchise bill.</p>
      <p style={styles.month}>{formatBillingMonth(year, month)}</p>
      <div style={styles.row2}>
        <label style={styles.field}>
          Year
          <input
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={styles.input}
          />
        </label>
        <label style={styles.field}>
          Month
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={styles.input}>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.month} value={m.month}>
                {m.month} — {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {preview?.periodStart && preview.periodEnd ? (
        <p style={styles.muted}>{formatIsoDateRange(preview.periodStart, preview.periodEnd)}</p>
      ) : null}
      {loading ? <p style={styles.muted}>Checking franchise…</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {!loading && preview ? (
        !preview.enabled ? (
          <p style={styles.warn}>
            {preview.label?.trim()
              ? preview.label
              : 'Franchise fee is not enrolled for this hub — nothing is due.'}
          </p>
        ) : preview.alreadyCollected ? (
          <>
            <p style={styles.heroMuted}>{money(preview.amount)}</p>
            <p style={styles.ok}>Franchise for {formatBillingMonth(year, month)} is already collected.</p>
          </>
        ) : (
          <>
            <p style={styles.hero}>{money(preview.amount)}</p>
            <p style={styles.meta}>
              Due for {formatBillingMonth(year, month)}
              {preview.label ? ` · ${preview.label}` : ''}
            </p>
            {Number(preview.amount) <= 0 ? (
              <p style={styles.muted}>No franchise amount for this month.</p>
            ) : (
              <p style={styles.muted}>Pay on the Franchise fee tab after KoyaKart issues the bill.</p>
            )}
          </>
        )
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
  hero: { margin: 0, fontSize: '1.35rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#c2410c' },
  heroMuted: { margin: 0, fontSize: '1.2rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' },
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
