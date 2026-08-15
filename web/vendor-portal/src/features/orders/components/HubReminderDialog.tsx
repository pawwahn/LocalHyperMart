import { useEffect, useId, type CSSProperties } from 'react';
import { Button } from '@/shared/ui';

type Props = {
  open: boolean;
  alertMessage: string;
  orderNumber?: string | null;
  bagNumber?: string | null;
  shopName?: string | null;
  busy?: boolean;
  error?: string | null;
  soundReady: boolean;
  onEnableSound: () => void;
  onNoticed: () => void;
};

/** Blocking hub reminder — only “Noticed order” closes it. */
export function HubReminderDialog({
  open,
  alertMessage,
  orderNumber,
  bagNumber,
  shopName,
  busy,
  error,
  soundReady,
  onEnableSound,
  onNoticed,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div style={styles.overlay} role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} style={styles.title}>
          {alertMessage}
        </h2>
        <p style={styles.description}>
          Pack this bag now. Sound stays on until you tap <strong>Noticed order</strong>.
        </p>
        <p style={styles.meta}>
          {orderNumber ? (
            <>
              Order <strong>{orderNumber}</strong>
              <br />
            </>
          ) : null}
          {bagNumber ? (
            <>
              Bag <strong>{bagNumber}</strong>
              <br />
            </>
          ) : null}
          {shopName ? <>Shop {shopName}</> : null}
        </p>
        {!soundReady ? (
          <p style={styles.soundWarn}>
            Sound is blocked in this browser.{' '}
            <button type="button" style={styles.inlineBtn} onClick={onEnableSound}>
              Enable sound
            </button>
          </p>
        ) : (
          <p style={styles.soundOn}>Sound is playing — tap below to stop it.</p>
        )}
        {error ? <p style={styles.error}>{error}</p> : null}
        <Button type="button" disabled={busy} onClick={onNoticed}>
          {busy ? 'Saving…' : 'Noticed order'}
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 20, 0.62)',
  },
  dialog: {
    width: 'min(26rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '2px solid #7c3aed',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.2rem',
    display: 'grid',
    gap: '0.7rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.25rem',
    color: '#5b21b6',
  },
  description: {
    margin: 0,
    fontSize: '0.92rem',
    lineHeight: 1.4,
    fontWeight: 600,
    color: 'var(--text)',
  },
  meta: {
    margin: 0,
    fontSize: '0.84rem',
    fontWeight: 700,
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },
  soundWarn: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#b45309',
    lineHeight: 1.35,
  },
  soundOn: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#7c3aed',
  },
  inlineBtn: {
    border: 'none',
    background: 'none',
    padding: 0,
    color: '#7c3aed',
    fontWeight: 800,
    textDecoration: 'underline',
    cursor: 'pointer',
    font: 'inherit',
  },
  error: { margin: 0, color: 'var(--danger)', fontWeight: 700, fontSize: '0.82rem' },
};
