import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Button } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { fetchSubOrder, type SubOrderView } from '@/features/orders/api/ordersApi';

type Props = {
  open: boolean;
  subOrderId: string | null;
  highlightItemId?: string | null;
  orderNumberHint?: string | null;
  onClose: () => void;
};

export function ClaimOrderDetailDialog({
  open,
  subOrderId,
  highlightItemId,
  orderNumberHint,
  onClose,
}: Props) {
  const titleId = useId();
  const { session } = useAuth();
  const [order, setOrder] = useState<SubOrderView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !subOrderId || !session) {
      setOrder(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSubOrder(session.accessToken, session.vendorId, subOrderId)
      .then((view) => {
        if (!cancelled) setOrder(view);
      })
      .catch((err) => {
        if (!cancelled) {
          setOrder(null);
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load order');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, subOrderId, session]);

  if (!open) return null;

  return (
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={styles.dialog}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={styles.header}>
          <div style={styles.headText}>
            <h2 id={titleId} style={styles.title}>
              Order details
            </h2>
            <p style={styles.subtitle}>
              {order?.subOrderNumber || orderNumberHint || 'Your shop bag for this claim'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Back
          </Button>
        </div>

        {loading ? <p style={styles.muted}>Loading order…</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}

        {order && !loading ? (
          <div style={styles.body}>
            <div style={styles.metaGrid}>
              <div>
                <span style={styles.metaLabel}>Order</span>
                <strong style={styles.metaValue}>{order.orderNumber}</strong>
              </div>
              <div>
                <span style={styles.metaLabel}>Your bag</span>
                <strong style={styles.metaValue}>{order.subOrderNumber}</strong>
              </div>
              <div>
                <span style={styles.metaLabel}>Status</span>
                <strong style={styles.metaValue}>{order.status}</strong>
              </div>
              <div>
                <span style={styles.metaLabel}>Subtotal</span>
                <strong style={styles.metaValue}>{order.subtotalLabel}</strong>
              </div>
              <div>
                <span style={styles.metaLabel}>Placed</span>
                <strong style={styles.metaValue}>{order.placedAtLabel}</strong>
              </div>
            </div>

            <h3 style={styles.itemsTitle}>Items in your bag</h3>
            <ul style={styles.itemList}>
              {order.items.map((item) => {
                const hot = Boolean(highlightItemId && item.orderItemId === highlightItemId);
                return (
                  <li key={item.orderItemId} style={hot ? styles.itemHot : styles.item}>
                    <span>
                      {item.quantity}
                      {item.unitCode ? ` ${item.unitCode.toLowerCase()}` : ''} × {item.name}
                      {item.cancelled ? ' · cancelled' : ''}
                      {hot ? ' · claimed' : ''}
                    </span>
                    <strong>{item.lineTotalLabel}</strong>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 20, 0.5)',
    backdropFilter: 'blur(2px)',
  },
  dialog: {
    width: 'min(40rem, 96vw)',
    maxHeight: 'min(86vh, 720px)',
    overflowY: 'auto',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '1rem 1.1rem',
    display: 'grid',
    gap: '0.75rem',
    boxSizing: 'border-box',
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' },
  headText: { minWidth: 0 },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' },
  subtitle: {
    margin: '0.15rem 0 0',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.88rem', fontWeight: 600 },
  body: { display: 'grid', gap: '0.65rem' },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
    gap: '0.45rem',
  },
  metaLabel: {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  metaValue: { fontSize: '0.85rem', fontWeight: 700, overflowWrap: 'anywhere' },
  itemsTitle: { margin: 0, fontSize: '0.88rem', fontWeight: 800 },
  itemList: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    fontSize: '0.85rem',
  },
  itemHot: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #7c3aed',
    background: 'rgba(124, 58, 237, 0.08)',
    fontSize: '0.85rem',
  },
};
