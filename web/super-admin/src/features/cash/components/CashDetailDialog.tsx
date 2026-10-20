import { useEffect, useId, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui';
import {
  fetchAdminOrderDetail,
  formatAdminPaymentLabel,
  formatWhen,
  money,
  shortOrderNo,
  type AdminOrderSummary,
} from '@/features/orders/api/ordersApi';
import type { CashPlace } from '../cashPlace';
import type { SettlementView } from '../cashSettlement';

type ShopLine = { name: string; amount: number };

type Props = {
  order: AdminOrderSummary;
  token: string;
  townId: string;
  townLabel: string;
  place: CashPlace;
  settlement: SettlementView;
  onClose: () => void;
};

export function CashDetailDialog({ order, token, townId, townLabel, place, settlement, onClose }: Props) {
  const titleId = useId();
  const [shops, setShops] = useState<ShopLine[] | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!token || !townId || !order.orderId) return;
    let cancelled = false;
    setShops(null);
    void fetchAdminOrderDetail(token, townId, order.orderId)
      .then((detail) => {
        if (cancelled) return;
        const lines = (detail.subOrders ?? []).map((bag) => ({
          name: bag.shopName?.trim() || 'Shop',
          amount: Number(bag.subtotal ?? 0),
        }));
        setShops(lines);
      })
      .catch(() => {
        if (!cancelled) setShops([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId, order.orderId]);

  return createPortal(
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
        <div style={styles.head}>
          <h2 id={titleId} style={styles.title}>
            {shortOrderNo(order.orderNumber)}
          </h2>
          <span style={styles.amount}>{money(order.totalAmount)}</span>
        </div>
        <dl style={styles.where}>
          <div>
            <dt style={styles.dt}>Town</dt>
            <dd style={styles.dd}>{townLabel || '—'}</dd>
          </div>
          <div>
            <dt style={styles.dt}>{shops && shops.length > 1 ? 'Shops' : 'Shop'}</dt>
            <dd style={styles.dd}>
              {shops == null
                ? '…'
                : shops.length === 0
                  ? '—'
                  : shops.map((shop) => `${shop.name} · ${money(shop.amount)}`).join(', ')}
            </dd>
          </div>
        </dl>
        <p style={styles.sentence}>{place.detail || place.sentence}</p>
        <p style={styles.sentence}>{settlement.detail}</p>
        <dl style={styles.grid}>
          <div>
            <dt style={styles.dt}>Cash with</dt>
            <dd style={styles.dd}>{place.title}</dd>
          </div>
          <div>
            <dt style={styles.dt}>Settlement</dt>
            <dd style={styles.dd}>{settlement.title}</dd>
          </div>
          <div>
            <dt style={styles.dt}>Payment</dt>
            <dd style={styles.dd}>
              {formatAdminPaymentLabel({
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                orderStatus: order.status,
              })}
            </dd>
          </div>
          <div>
            <dt style={styles.dt}>Status</dt>
            <dd style={styles.dd}>{order.status}</dd>
          </div>
          <div>
            <dt style={styles.dt}>Placed</dt>
            <dd style={styles.dd}>{formatWhen(order.placedAt)}</dd>
          </div>
          <div>
            <dt style={styles.dt}>Buyer</dt>
            <dd style={styles.dd}>{order.buyerPhone || '—'}</dd>
          </div>
        </dl>
        <div style={styles.actions}>
          <Link to={`/orders/${order.orderId}?townId=${encodeURIComponent(townId)}`} style={styles.link}>
            Open order
          </Link>
          <Button type="button" variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1300,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(15, 23, 20, 0.45)',
    backdropFilter: 'blur(2px)',
  },
  dialog: {
    width: 'min(28rem, 100%)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderTop: '4px solid var(--brand, #0C831F)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-elevated)',
    padding: '0.9rem 1rem',
    display: 'grid',
    gap: '0.55rem',
  },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.6rem' },
  title: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' },
  amount: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  sentence: { margin: 0, color: 'var(--text)', fontSize: '0.86rem', lineHeight: 1.4, fontWeight: 650 },
  where: { display: 'grid', gap: '0.35rem', margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 0.75rem', margin: 0 },
  dt: { margin: 0, fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  dd: { margin: '0.05rem 0 0', fontSize: '0.84rem', fontWeight: 700 },
  actions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.55rem' },
  link: { color: 'var(--accent)', fontWeight: 750, fontSize: '0.84rem' },
};
