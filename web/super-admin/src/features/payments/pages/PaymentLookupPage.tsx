import { useCallback, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { KpiCard } from '@/shared/ui/KpiCard';
import { PaymentsSubNav } from '../components/PaymentsSubNav';
import { lookupOrderPayments, type AdminOrderPayments, type AdminPaymentAttempt } from '../api/paymentLookupApi';

function money(n: number | undefined, currency = 'INR'): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusPill(status: string): CSSProperties {
  const s = (status ?? '').toUpperCase();
  if (s === 'SUCCESS' || s === 'PAID') {
    return { ...styles.pill, color: '#0a6b2d', background: 'linear-gradient(135deg, #e8f8ee 0%, #d4f0dd 100%)' };
  }
  if (s === 'FAILED' || s === 'PAYMENT_FAILED') {
    return { ...styles.pill, color: '#b42318', background: 'linear-gradient(135deg, #fdecea 0%, #fad4d0 100%)' };
  }
  if (s === 'PENDING' || s === 'PAYMENT_PENDING') {
    return { ...styles.pill, color: '#9a5f10', background: 'linear-gradient(135deg, #fff8e6 0%, #ffefcc 100%)' };
  }
  return { ...styles.pill, color: 'var(--text-muted)', background: 'var(--bg-muted)' };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyChip({ label, value }: { label: string; value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  const v = (value ?? '').trim();
  if (!v) {
    return (
      <div style={styles.chipEmpty}>
        <span style={styles.chipLabel}>{label}</span>
        <span style={styles.chipMuted}>Not set yet</span>
      </div>
    );
  }
  return (
    <div style={styles.chip}>
      <div style={styles.chipTop}>
        <span style={styles.chipLabel}>{label}</span>
        <button
          type="button"
          style={styles.copyBtn}
          onClick={() => {
            void copyText(v).then((ok) => {
              if (ok) {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code style={styles.chipValue}>{v}</code>
    </div>
  );
}

function AttemptCard({ attempt, highlight }: { attempt: AdminPaymentAttempt; highlight: boolean }) {
  const gateway = (attempt.gateway ?? '—').replace(/_/g, ' ');
  return (
    <article style={{ ...styles.attempt, ...(highlight ? styles.attemptHighlight : null) }}>
      <div style={styles.attemptHead}>
        <div style={styles.attemptTitle}>
          <span style={styles.gatewayBadge}>{gateway}</span>
          <span style={statusPill(attempt.status)}>{attempt.status}</span>
          {highlight ? <span style={styles.primaryTag}>Latest success</span> : null}
        </div>
        <strong style={styles.attemptAmount}>{money(attempt.amount, attempt.currency ?? 'INR')}</strong>
      </div>
      <div style={styles.chipGrid}>
        <CopyChip label="PSP payment / txn id" value={attempt.gatewayPaymentId} />
        <CopyChip label="PSP order id" value={attempt.gatewayOrderId} />
        <CopyChip label="Internal payment id" value={attempt.paymentId} />
      </div>
      <div style={styles.attemptMeta}>
        <span>Created {formatWhen(attempt.createdAt)}</span>
        <span>Paid {formatWhen(attempt.paidAt)}</span>
      </div>
    </article>
  );
}

export function PaymentLookupPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AdminOrderPayments | null>(null);

  const search = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!token || !q) return;
      setLoading(true);
      setError('');
      setResult(null);
      try {
        setResult(await lookupOrderPayments(token, q));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Lookup failed');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void search(query);
  }

  const successAttempt = result?.payments.find((p) => (p.status ?? '').toUpperCase() === 'SUCCESS');
  const txnId = successAttempt?.gatewayPaymentId ?? result?.payments[0]?.gatewayPaymentId;

  return (
    <PortalShell
      title="Payments"
      subtitle="Find Razorpay / Cashfree transaction ids for any order"
      onRefresh={result ? () => void search(result.orderNumber || query) : undefined}
    >
      <PaymentsSubNav />

      <section style={styles.hero}>
        <div style={styles.heroGlow} aria-hidden />
        <div style={styles.heroInner}>
          <h2 style={styles.heroTitle}>Order payment lookup</h2>
          <p style={styles.heroHint}>Paste the buyer order number or internal order UUID. We load every checkout attempt.</p>
          <form style={styles.searchRow} onSubmit={onSubmit}>
            <TextField
              id="payment-lookup-q"
              label="Order number or id"
              placeholder="e.g. KK/AP-031126-0042"
              value={query}
              disabled={loading}
              style={styles.searchInput}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" disabled={loading || !query.trim()} style={styles.searchBtn}>
              {loading ? 'Searching…' : 'Find payments'}
            </Button>
          </form>
        </div>
      </section>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {result ? (
        <div style={styles.results}>
          <Card padding="sm" style={styles.orderCard}>
            <div style={styles.orderHead}>
              <div>
                <p style={styles.orderEyebrow}>Order</p>
                <h3 style={styles.orderNumber}>{result.orderNumber}</h3>
                <p style={styles.orderSub}>
                  {result.paymentMethod} · {result.paymentStatus} · {money(result.orderTotal)}
                </p>
              </div>
              <div style={styles.orderActions}>
                <Link
                  to={`/orders/${result.orderId}?townId=${encodeURIComponent(result.townId)}`}
                  style={styles.orderLink}
                >
                  Open order →
                </Link>
              </div>
            </div>
            <div style={styles.kpiRow}>
              <KpiCard
                label="Txn id (success)"
                value={txnId?.trim() ? txnId : '—'}
                hint={successAttempt ? `${successAttempt.gateway} capture` : 'No successful online payment row'}
                tip="PSP payment id stored after checkout succeeds (pay_… on Razorpay)."
              />
              <KpiCard
                label="Attempts"
                value={String(result.payments.length)}
                hint="Includes retries and abandoned checkouts"
              />
              <KpiCard
                label="Buyer phone"
                value={result.buyerPhone?.trim() ? result.buyerPhone : '—'}
                hint={`Status ${result.orderStatus}`}
              />
            </div>
            {txnId ? (
              <div style={styles.heroTxn}>
                <CopyChip label="Quick copy — transaction id" value={txnId} />
              </div>
            ) : null}
          </Card>

          <h4 style={styles.sectionTitle}>Payment attempts</h4>
          {result.payments.length === 0 ? (
            <Banner tone="warning">No payment rows in payment-service for this order (COD or not initiated online).</Banner>
          ) : (
            <div style={styles.attemptList}>
              {result.payments.map((attempt) => (
                <AttemptCard
                  key={attempt.paymentId}
                  attempt={attempt}
                  highlight={
                    !!successAttempt &&
                    attempt.paymentId === successAttempt.paymentId &&
                    (attempt.status ?? '').toUpperCase() === 'SUCCESS'
                  }
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid var(--border)',
    marginBottom: '0.55rem',
    background: 'linear-gradient(135deg, var(--bg-elevated) 0%, color-mix(in srgb, var(--accent) 8%, var(--bg)) 100%)',
  },
  heroGlow: {
    position: 'absolute',
    inset: '-40% -20% auto auto',
    width: '55%',
    height: '140%',
    background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroInner: { position: 'relative', padding: '0.85rem 1rem 1rem', display: 'grid', gap: '0.45rem' },
  heroTitle: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.25rem', letterSpacing: '-0.03em' },
  heroHint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 520 },
  searchRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '0.4rem',
    alignItems: 'end',
    maxWidth: 720,
  },
  searchInput: { padding: '0.45rem 0.6rem', minHeight: 44, fontSize: '0.92rem' },
  searchBtn: { minHeight: 44, padding: '0 1.1rem', whiteSpace: 'nowrap' },
  results: { display: 'grid', gap: '0.5rem', maxWidth: 920 },
  orderCard: { display: 'grid', gap: '0.55rem' },
  orderHead: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderEyebrow: { margin: 0, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' },
  orderNumber: { margin: '0.1rem 0', fontFamily: 'var(--font-display)', fontSize: '1.35rem', letterSpacing: '-0.02em' },
  orderSub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' },
  orderActions: { display: 'flex', alignItems: 'center' },
  orderLink: {
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--accent)',
    textDecoration: 'none',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
  },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.4rem' },
  heroTxn: { marginTop: '0.15rem' },
  sectionTitle: { margin: '0.35rem 0 0', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-muted)' },
  attemptList: { display: 'grid', gap: '0.45rem' },
  attempt: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '0.65rem 0.75rem',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.45rem',
  },
  attemptHighlight: {
    borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))',
    boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)',
  },
  attemptHead: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.35rem', alignItems: 'center' },
  attemptTitle: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' },
  gatewayBadge: {
    fontSize: '0.72rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '0.2rem 0.45rem',
    borderRadius: 6,
    background: 'var(--bg-muted)',
    color: 'var(--text)',
  },
  pill: {
    fontSize: '0.72rem',
    fontWeight: 800,
    padding: '0.18rem 0.5rem',
    borderRadius: 999,
  },
  primaryTag: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--accent)',
    textTransform: 'uppercase',
  },
  attemptAmount: { fontFamily: 'var(--font-display)', fontSize: '1.05rem' },
  chipGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.4rem' },
  chip: {
    border: '1px dashed var(--border)',
    borderRadius: 10,
    padding: '0.45rem 0.55rem',
    background: 'var(--bg)',
    display: 'grid',
    gap: '0.25rem',
    minWidth: 0,
  },
  chipEmpty: {
    border: '1px dashed var(--border)',
    borderRadius: 10,
    padding: '0.45rem 0.55rem',
    background: 'var(--bg)',
    display: 'grid',
    gap: '0.15rem',
  },
  chipTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem' },
  chipLabel: { fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' },
  chipMuted: { fontSize: '0.78rem', color: 'var(--text-muted)' },
  chipValue: {
    fontSize: '0.78rem',
    wordBreak: 'break-all',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  copyBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 6,
    padding: '0.15rem 0.45rem',
    fontSize: '0.68rem',
    fontWeight: 800,
    cursor: 'pointer',
    color: 'var(--text-muted)',
    minHeight: 28,
  },
  attemptMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.65rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
};
