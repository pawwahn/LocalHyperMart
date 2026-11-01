import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { PaymentGatewayOptionList, type GatewayOption } from './PaymentGatewayChoices';

const C = {
  ink: '#101828',
  inkSoft: '#344054',
  inkMuted: '#667085',
  line: '#D0D5DD',
  lineStrong: '#98A2B3',
  brand: '#009111',
  brandSoft: '#E5F5E7',
  brandBorder: '#009111',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',
  sheetBg: '#F2F4F7',
} as const;

type Props = {
  open: boolean;
  amountLabel: string;
  options: GatewayOption[];
  value: string;
  onChange: (id: string) => void;
  busy?: boolean;
  onClose: () => void;
  onContinue: () => void;
};

export function OnlinePaymentSheet({
  open,
  amountLabel,
  options,
  value,
  onChange,
  busy,
  onClose,
  onContinue,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div style={styles.backdrop} role="presentation" onClick={busy ? undefined : onClose}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-labelledby="online-pay-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.handle} aria-hidden />
        <header style={styles.head}>
          <div style={styles.headCopy}>
            <p style={styles.kicker}>Secure payment</p>
            <h2 id="online-pay-sheet-title" style={styles.title}>
              Pay {amountLabel}
            </h2>
            <p style={styles.sub}>Pick a checkout route — both support UPI and cards.</p>
          </div>
          <button type="button" style={styles.close} onClick={onClose} disabled={busy} aria-label="Close">
            ×
          </button>
        </header>
        <div style={styles.body}>
          <PaymentGatewayOptionList value={value} options={options} onChange={onChange} disabled={busy} />
          <p style={styles.note}>100% secure · Order is confirmed only after payment succeeds.</p>
        </div>
        <footer style={styles.footer}>
          <button type="button" style={styles.cta} disabled={busy || !value} onClick={onContinue}>
            {busy ? 'Opening checkout…' : `Pay ${amountLabel}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 140,
    background: 'rgba(16, 24, 40, 0.55)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 'var(--shell-max)',
    margin: '0 auto',
    maxHeight: 'min(90dvh, 680px)',
    background: C.sheetBg,
    color: C.ink,
    borderRadius: '20px 20px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 -16px 48px rgba(16, 24, 40, 0.22)',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    background: C.line,
    margin: '10px auto 0',
    flexShrink: 0,
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    padding: '0.65rem 1rem 0.5rem',
    background: C.surface,
    borderBottom: `1px solid ${C.line}`,
    flexShrink: 0,
  },
  headCopy: { flex: 1, minWidth: 0 },
  kicker: { margin: 0, fontSize: '0.72rem', fontWeight: 600, color: C.inkMuted },
  title: { margin: '0.12rem 0 0', fontSize: '1.2rem', fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' },
  sub: { margin: '0.28rem 0 0', fontSize: '0.8rem', color: C.inkSoft, lineHeight: 1.4 },
  close: {
    border: `1px solid ${C.line}`,
    background: C.surfaceMuted,
    width: 36,
    height: 36,
    borderRadius: 999,
    fontSize: '1.35rem',
    lineHeight: 1,
    cursor: 'pointer',
    color: C.inkSoft,
    flexShrink: 0,
  },
  body: {
    padding: '0.85rem 1rem 0.35rem',
    overflowY: 'auto',
    flex: '1 1 auto',
    minHeight: 0,
  },
  note: { margin: '0.85rem 0 0', fontSize: '0.74rem', color: C.inkMuted, lineHeight: 1.45 },
  footer: {
    padding: '0.75rem 1rem calc(0.9rem + env(safe-area-inset-bottom, 0px))',
    borderTop: `1px solid ${C.line}`,
    background: C.surface,
    flexShrink: 0,
    boxShadow: '0 -4px 16px rgba(16, 24, 40, 0.06)',
  },
  cta: {
    width: '100%',
    minHeight: 'var(--touch-min, 48px)',
    border: 'none',
    borderRadius: 12,
    background: C.brand,
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '0.98rem',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(12, 131, 31, 0.35)',
  },
};
