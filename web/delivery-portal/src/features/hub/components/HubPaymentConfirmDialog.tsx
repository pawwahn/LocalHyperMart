import { useEffect, type CSSProperties, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  hint: string;
  amount: number;
  paymentDate: string;
  paymentReference: string;
  notes?: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onBack: () => void;
  extra?: ReactNode;
};

function money(n: number): string {
  return `₹${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function formatPayDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
}

export function HubPaymentConfirmDialog({
  open,
  title,
  hint,
  amount,
  paymentDate,
  paymentReference,
  notes,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onBack,
  extra,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onBack]);

  if (!open) return null;

  return (
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onBack();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} style={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.hint}>{hint}</p>
        <dl style={styles.dl}>
          <div style={styles.row}>
            <dt style={styles.dt}>Amount</dt>
            <dd style={styles.ddStrong}>{money(amount)}</dd>
          </div>
          <div style={styles.row}>
            <dt style={styles.dt}>Paid</dt>
            <dd style={styles.dd}>{formatPayDate(paymentDate)}</dd>
          </div>
          <div style={styles.row}>
            <dt style={styles.dt}>UTR</dt>
            <dd style={styles.ddMono}>{paymentReference}</dd>
          </div>
          {notes?.trim() ? (
            <div style={styles.noteRow}>
              <dt style={styles.dt}>Note</dt>
              <dd style={styles.ddNote}>{notes.trim()}</dd>
            </div>
          ) : null}
        </dl>
        {extra}
        {error ? <p style={styles.error}>{error}</p> : null}
        <div style={styles.actions}>
          <button type="button" style={styles.backBtn} disabled={busy} onClick={onBack}>
            Back
          </button>
          <button type="button" style={styles.yesBtn} disabled={busy} onClick={onConfirm}>
            {busy ? 'Submitting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    display: 'grid',
    placeItems: 'center',
    padding: '0.75rem',
    background: 'rgba(12, 18, 24, 0.55)',
  },
  dialog: {
    width: 'min(26rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: 'var(--shadow-elevated)',
    padding: '0.85rem',
    display: 'grid',
    gap: '0.4rem',
  },
  title: { margin: 0, fontSize: '1rem', fontWeight: 800 },
  hint: { margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 },
  dl: { margin: 0, display: 'grid', gap: '0.22rem' },
  row: { display: 'grid', gridTemplateColumns: '4.2rem 1fr', gap: '0.4rem', alignItems: 'baseline' },
  noteRow: { display: 'grid', gridTemplateColumns: '4.2rem 1fr', gap: '0.4rem', alignItems: 'start' },
  dt: { margin: 0, fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' },
  dd: { margin: 0, fontSize: '0.82rem', fontWeight: 650 },
  ddStrong: { margin: 0, fontSize: '0.95rem', fontWeight: 800 },
  ddMono: { margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', fontWeight: 700, wordBreak: 'break-all' },
  ddNote: { margin: 0, fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.35, whiteSpace: 'pre-wrap' },
  error: { margin: 0, fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 700 },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '0.4rem', marginTop: '0.15rem' },
  backBtn: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.55rem 0.7rem',
    minHeight: 44,
    background: 'var(--bg)',
    color: 'var(--text)',
    fontWeight: 750,
    fontSize: '0.88rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  yesBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '0.55rem 0.7rem',
    minHeight: 44,
    background: '#059669',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.88rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
