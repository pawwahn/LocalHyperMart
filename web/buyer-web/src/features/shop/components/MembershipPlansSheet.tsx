import { useEffect, type CSSProperties } from 'react';
import { MembershipPlansPanel } from './MembershipPlansPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  onBought?: () => void;
};

export function MembershipPlansSheet({ open, onClose, onBought }: Props) {
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
    <div style={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-labelledby="membership-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.handle} aria-hidden />
        <header style={styles.head}>
          <div style={styles.headCopy}>
            <p style={styles.kicker}>HyperLocalMart</p>
            <h2 id="membership-sheet-title" style={styles.title}>
              Free delivery
            </h2>
            <p style={styles.sub}>One plan. Free drops on orders that would have a delivery fee.</p>
          </div>
          <button type="button" style={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div style={styles.body}>
          <MembershipPlansPanel onBought={onBought} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 95,
    background: 'rgba(16, 24, 40, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 'var(--shell-max)',
    margin: '0 auto',
    maxHeight: 'min(90dvh, 680px)',
    background: '#F4F6F5',
    color: '#1A1C1A',
    borderRadius: '20px 20px 0 0',
    display: 'grid',
    gridTemplateRows: 'auto auto 1fr',
    overflow: 'hidden',
    boxShadow: '0 -12px 40px rgba(16, 24, 40, 0.18)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    background: '#D1D5DB',
    justifySelf: 'center',
    marginTop: 8,
  },
  head: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '0.5rem',
    alignItems: 'start',
    padding: '0.45rem 0.9rem 0.7rem',
    background: 'linear-gradient(180deg, #E7F6EC 0%, #F4F6F5 100%)',
  },
  headCopy: { display: 'grid', gap: '0.18rem', minWidth: 0 },
  kicker: {
    margin: 0,
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#0C831F',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
  },
  sub: { margin: 0, fontSize: '0.78rem', color: '#6B7280', fontWeight: 600, lineHeight: 1.35 },
  close: {
    width: 40,
    height: 40,
    border: 'none',
    borderRadius: 999,
    background: '#fff',
    color: '#1A1C1A',
    fontSize: '1.35rem',
    lineHeight: 1,
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(16,24,40,0.08)',
  },
  body: { overflow: 'auto', padding: '0.15rem 0.9rem 1.1rem' },
};
