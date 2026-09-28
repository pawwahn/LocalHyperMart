import { useEffect, type CSSProperties } from 'react';
import type { CatalogItemView } from '@/features/shop/api/shopApi';
import { MealPlannerPanel } from './MealPlannerPanel';

type Props = {
  open: boolean;
  townId: string;
  busyKey: string | null;
  quantityFor: (listingId: string) => number;
  rememberItems: (next: CatalogItemView[], mode: 'replace' | 'append') => void;
  onIncrease: (listingId: string) => void;
  onDecrease: (listingId: string) => void;
  onClose: () => void;
};

export function MealPlannerSheet({
  open,
  townId,
  busyKey,
  quantityFor,
  rememberItems,
  onIncrease,
  onDecrease,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !townId) return null;

  return (
    <div style={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        style={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-planner-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close meal planner">
          ×
        </button>
        <h2 id="meal-planner-sheet-title" style={styles.srOnly}>
          Meal planner
        </h2>
        <div style={styles.scroll} className="hlm-hide-scrollbar">
          <MealPlannerPanel
            townId={townId}
            busyKey={busyKey}
            quantityFor={quantityFor}
            rememberItems={rememberItems}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
          />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    paddingTop: 10,
  },
  sheet: {
    position: 'relative',
    width: '100%',
    maxWidth: 'var(--shell-max)',
    margin: '0 auto',
    height: 'min(94dvh, 100%)',
    background: 'var(--bg)',
    color: 'var(--text)',
    borderRadius: '22px 22px 0 0',
    display: 'grid',
    gridTemplateRows: '1fr',
    overflow: 'hidden',
    animation: 'hlm-slide-up 220ms ease both',
    boxShadow: '0 -8px 28px rgba(0,0,0,0.28)',
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 3,
    width: 34,
    height: 34,
    border: 'none',
    borderRadius: 999,
    background: '#fff',
    color: '#111',
    fontSize: '1.35rem',
    lineHeight: 1,
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
  scroll: {
    minHeight: 0,
    overflowY: 'auto',
    padding: '2.75rem 0.65rem 1rem',
  },
};
