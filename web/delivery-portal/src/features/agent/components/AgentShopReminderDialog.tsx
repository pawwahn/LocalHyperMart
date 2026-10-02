import { useEffect, useId, type CSSProperties } from 'react';
import { Button } from '@/shared/ui';

type Props = {
  open: boolean;
  shopName: string;
  bagNumber?: string | null;
  soundReady: boolean;
  busy?: boolean;
  onEnableSound: () => void;
  onAcknowledge: () => void;
};

/** Shop or hub nudge — same pattern as vendor hub reminder. */
export function AgentShopReminderDialog({
  open,
  shopName,
  bagNumber,
  soundReady,
  busy,
  onEnableSound,
  onAcknowledge,
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
          {shopName} is calling you
        </h2>
        <p style={styles.description}>
          Pick up or start this delivery now. Alert repeats until you tap <strong>Got it</strong>.
        </p>
        {bagNumber ? (
          <p style={styles.meta}>
            Bag <strong>{bagNumber}</strong>
          </p>
        ) : null}
        {!soundReady ? (
          <p style={styles.soundWarn}>
            Sound may be blocked.{' '}
            <button type="button" style={styles.inlineBtn} onClick={onEnableSound}>
              Enable sound
            </button>
          </p>
        ) : (
          <p style={styles.soundOn}>Alert is playing — acknowledge to stop.</p>
        )}
        <Button type="button" disabled={busy} onClick={onAcknowledge}>
          {busy ? 'Saving…' : 'Got it'}
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2600,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 42, 0.72)',
  },
  dialog: {
    width: 'min(22rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '2px solid #7c3aed',
    borderRadius: 'var(--radius-lg)',
    padding: '1.15rem',
    display: 'grid',
    gap: '0.65rem',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.25rem',
    color: '#5b21b6',
    lineHeight: 1.25,
  },
  description: {
    margin: 0,
    fontSize: '0.88rem',
    lineHeight: 1.4,
    fontWeight: 600,
  },
  meta: {
    margin: 0,
    fontSize: '0.84rem',
    fontWeight: 700,
  },
  soundWarn: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#b45309',
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
};
