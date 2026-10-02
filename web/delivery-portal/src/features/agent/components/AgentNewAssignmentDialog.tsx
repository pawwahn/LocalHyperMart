import { useEffect, useId, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui';

type Props = {
  open: boolean;
  orderLabel: string;
  legHint?: string | null;
  soundReady: boolean;
  onEnableSound: () => void;
  onAcknowledge: () => void;
};

/** Full-screen alert for new jobs — critical on mobile PWA where audio is easy to miss. */
export function AgentNewAssignmentDialog({
  open,
  orderLabel,
  legHint,
  soundReady,
  onEnableSound,
  onAcknowledge,
}: Props) {
  const titleId = useId();
  const navigate = useNavigate();

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
        <p style={styles.kicker}>New delivery</p>
        <h2 id={titleId} style={styles.title}>
          {orderLabel}
        </h2>
        {legHint ? <p style={styles.hint}>{legHint}</p> : null}
        <p style={styles.description}>
          Hub or shop assigned you a job. Sound and vibration repeat until you tap{' '}
          <strong>Got it</strong>.
        </p>
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
        <div style={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => navigate('/agent')}>
            Open home
          </Button>
          <Button type="button" onClick={onAcknowledge}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2500,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
    background: 'rgba(15, 23, 42, 0.72)',
  },
  dialog: {
    width: 'min(22rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '2px solid var(--accent)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1.15rem',
    display: 'grid',
    gap: '0.65rem',
  },
  kicker: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.35rem',
    lineHeight: 1.2,
    overflowWrap: 'anywhere',
  },
  hint: {
    margin: 0,
    fontSize: '0.84rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  description: {
    margin: 0,
    fontSize: '0.88rem',
    lineHeight: 1.4,
    fontWeight: 600,
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
    color: 'var(--accent)',
  },
  inlineBtn: {
    border: 'none',
    background: 'none',
    padding: 0,
    color: 'var(--accent)',
    fontWeight: 800,
    textDecoration: 'underline',
    cursor: 'pointer',
    font: 'inherit',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
};
