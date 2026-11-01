import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiError } from '@/shared/api/http';
import {
  fetchHubPaymentPayable,
  submitHubPlatformPayment,
  type HubPaymentPayable,
  type HubPaymentSubmission,
} from '../api/hubPaymentApi';

type Props = {
  token: string;
  submissions: HubPaymentSubmission[];
  onSubmitted: () => void;
};

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

export function HubSettlePaymentPanel({ token, submissions, onSubmitted }: Props) {
  const [payable, setPayable] = useState<HubPaymentPayable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeCod, setIncludeCod] = useState(true);
  const [includeFranchise, setIncludeFranchise] = useState(true);
  const [paymentDate, setPaymentDate] = useState(todayIso);
  const [paymentReference, setPaymentReference] = useState('');
  const [hubNotes, setHubNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pending = useMemo(
    () => submissions.find((s) => s.status === 'PENDING_VERIFICATION') ?? null,
    [submissions],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchHubPaymentPayable(token);
      setPayable(p);
      setIncludeCod(p.codPayable);
      setIncludeFranchise(p.franchisePayable);
    } catch (err) {
      setPayable(null);
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load payable amounts');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => {
    if (!payable) return 0;
    let t = 0;
    if (includeCod && payable.codPayable) t += Number(payable.codOwedToCompany ?? 0);
    if (includeFranchise && payable.franchisePayable) t += Number(payable.franchiseAmount ?? 0);
    return Math.round(t * 100) / 100;
  }, [payable, includeCod, includeFranchise]);

  const canSubmit = payable && !pending && total > 0 && (includeCod || includeFranchise) && paymentReference.trim();

  async function onSubmit() {
    if (!payable || !canSubmit) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await submitHubPlatformPayment(token, {
        paymentDate,
        paymentReference: paymentReference.trim(),
        hubNotes: hubNotes.trim() || undefined,
        totalAmount: total,
        includeCod: includeCod && payable.codPayable,
        includeFranchise: includeFranchise && payable.franchisePayable,
      });
      setNotice('Sent to KoyaKart for verification.');
      setPaymentReference('');
      setHubNotes('');
      onSubmitted();
      void load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not submit payment');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !payable) {
    return <p style={styles.muted}>Loading amounts…</p>;
  }

  if (pending) {
    return (
      <div style={styles.pendingCard}>
        <span style={styles.pendingIcon} aria-hidden>
          ⏳
        </span>
        <div style={styles.pendingBody}>
          <p style={styles.pendingTitle}>Waiting for KoyaKart</p>
          <p style={styles.pendingAmount}>{money(pending.totalAmount)}</p>
          <p style={styles.pendingMeta}>
            Ref {pending.paymentReference}
            {pending.hubNotes ? ` · ${pending.hubNotes}` : ''}
          </p>
          <p style={styles.mutedSmall}>Balances update only after admin confirms your bank transfer.</p>
        </div>
      </div>
    );
  }

  if (!payable) {
    return error ? <p style={styles.error}>{error}</p> : null;
  }

  const nothingDue = !payable.codPayable && !payable.franchisePayable;

  return (
    <div style={styles.wrap}>
      {error ? <p style={styles.error}>{error}</p> : null}
      {notice ? <p style={styles.ok}>{notice}</p> : null}

      {nothingDue ? (
        <div style={styles.allClear}>
          <span style={styles.allClearIcon} aria-hidden>
            ✓
          </span>
          <p style={styles.allClearTitle}>Nothing to pay right now</p>
          <p style={styles.muted}>COD and franchise are clear, or already submitted for verification.</p>
        </div>
      ) : (
        <>
          <p style={styles.stepLead}>1 · Choose what this payment covers</p>
          <div style={styles.tileRow}>
            <AmountTile
              title="COD to KoyaKart"
              amount={payable.codOwedToCompany}
              subtitle="Cash you confirmed from agents"
              selected={includeCod && payable.codPayable}
              disabled={!payable.codPayable}
              onToggle={() => payable.codPayable && setIncludeCod((v) => !v)}
            />
            <AmountTile
              title="Franchise fee"
              amount={payable.franchiseAmount}
              subtitle={payable.franchiseLabel ?? 'Monthly franchise'}
              selected={includeFranchise && payable.franchisePayable}
              disabled={!payable.franchisePayable}
              onToggle={() => payable.franchisePayable && setIncludeFranchise((v) => !v)}
            />
          </div>

          <p style={styles.stepLead}>2 · Payment details</p>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              Date paid
              <input type="date" value={paymentDate} max={todayIso()} onChange={(e) => setPaymentDate(e.target.value)} style={styles.input} />
            </label>
            <label style={styles.field}>
              UTR / transaction ID
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="From bank or UPI"
                style={styles.input}
              />
            </label>
          </div>
          <label style={styles.field}>
            Note for KoyaKart (optional)
            <textarea
              value={hubNotes}
              onChange={(e) => setHubNotes(e.target.value)}
              rows={2}
              placeholder="e.g. GPay from hub account"
              style={styles.textarea}
            />
          </label>

          <div style={styles.submitBar}>
            <div>
              <span style={styles.totalLabel}>Total transfer</span>
              <strong style={styles.totalValue}>{money(total)}</strong>
            </div>
            <button type="button" style={styles.primaryBtn} disabled={!canSubmit || busy} onClick={() => void onSubmit()}>
              {busy ? 'Submitting…' : 'Submit for verification'}
            </button>
          </div>
          <p style={styles.mutedSmall}>Amount must match exactly — refresh if COD or franchise changed.</p>
        </>
      )}
    </div>
  );
}

function AmountTile({
  title,
  amount,
  subtitle,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  amount: number;
  subtitle: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      style={{
        ...styles.tile,
        ...(selected ? styles.tileOn : null),
        ...(disabled ? styles.tileOff : null),
      }}
    >
      <span style={styles.tileCheck}>{selected ? '✓' : ''}</span>
      <span style={styles.tileTitle}>{title}</span>
      <strong style={styles.tileAmount}>{money(amount)}</strong>
      <span style={styles.tileSub}>{disabled ? 'Not due' : subtitle}</span>
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem' },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 },
  mutedSmall: { margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.35 },
  error: { margin: 0, fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 650 },
  ok: { margin: 0, fontSize: '0.78rem', color: '#15803d', fontWeight: 700 },
  stepLead: { margin: '0.15rem 0 0', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  tileRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.45rem' },
  tile: {
    textAlign: 'left',
    borderRadius: 14,
    border: '2px solid var(--border)',
    background: 'var(--bg-elevated)',
    padding: '0.55rem 0.6rem',
    display: 'grid',
    gap: '0.12rem',
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
  },
  tileOn: {
    borderColor: 'var(--accent)',
    background: 'color-mix(in srgb, var(--accent-soft) 40%, var(--bg-elevated))',
    boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent)',
  },
  tileOff: { opacity: 0.55, cursor: 'not-allowed' },
  tileCheck: { fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent)', minHeight: '0.9rem' },
  tileTitle: { fontSize: '0.72rem', fontWeight: 800 },
  tileAmount: { fontSize: '1rem', fontVariantNumeric: 'tabular-nums' },
  tileSub: { fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.3 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.45rem' },
  field: { display: 'grid', gap: '0.2rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' },
  input: {
    font: 'inherit',
    fontSize: '0.85rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  textarea: {
    font: 'inherit',
    fontSize: '0.85rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    resize: 'vertical',
  },
  submitBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 14,
    background: 'color-mix(in srgb, var(--accent-soft) 35%, var(--bg-elevated))',
    border: '1px solid color-mix(in srgb, var(--accent) 25%, var(--border))',
  },
  totalLabel: { display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' },
  totalValue: { fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' },
  primaryBtn: {
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--text-inverse, #fff)',
    borderRadius: 999,
    padding: '0.55rem 1.1rem',
    fontWeight: 800,
    fontSize: '0.82rem',
    cursor: 'pointer',
    boxShadow: '0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent)',
  },
  pendingCard: {
    display: 'flex',
    gap: '0.65rem',
    alignItems: 'flex-start',
    padding: '0.85rem 0.9rem',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '1px solid #fde68a',
  },
  pendingIcon: { fontSize: '1.35rem', lineHeight: 1 },
  pendingBody: { display: 'grid', gap: '0.2rem', flex: 1 },
  pendingTitle: { margin: 0, fontSize: '0.78rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.03em' },
  pendingAmount: { margin: 0, fontSize: '1.35rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#78350f' },
  pendingMeta: { margin: 0, fontSize: '0.75rem', fontWeight: 650, color: '#92400e' },
  allClear: {
    textAlign: 'center',
    padding: '1.5rem 1rem',
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  allClearIcon: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '50%',
    background: '#ecfdf5',
    color: '#15803d',
    fontWeight: 900,
    fontSize: '1.1rem',
  },
  allClearTitle: { margin: '0.5rem 0 0.15rem', fontWeight: 800, fontSize: '0.95rem' },
};
