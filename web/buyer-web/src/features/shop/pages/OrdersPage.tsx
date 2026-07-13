import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Badge, Banner, Button, Card, EmptyState, LoadingBlock } from '@/shared/ui';
import { useShop } from '../hooks/useShop';

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'brand' {
  const s = status.toLowerCase();
  if (s.includes('deliver') || s.includes('complete') || s.includes('paid')) return 'success';
  if (s.includes('cancel') || s.includes('fail')) return 'danger';
  if (s.includes('pending') || s.includes('placed') || s.includes('confirm')) return 'brand';
  if (s.includes('cod') || s.includes('unpaid')) return 'warning';
  return 'neutral';
}

function formatWhen(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { orders, cart, loading, error, reload } = useShop();
  const authExpired = Boolean(error && /sign-in expired|invalid jwt|unauthorized/i.test(error));

  return (
    <PortalShell
      title="My orders"
      subtitle="Your recent COD orders from local shops"
      cartCount={cart?.itemCount ?? 0}
      onRefresh={() => void reload()}
      showDeliveryBanner={false}
    >
      {loading && orders.length === 0 ? (
        <LoadingBlock label="Loading your order history…" />
      ) : error && orders.length === 0 ? (
        <EmptyState
          icon="⚠️"
          title={authExpired ? 'Please sign in again' : 'Couldn’t load your orders'}
          description={
            authExpired
              ? 'Your login session expired. Sign in again to see your order history.'
              : 'Something went wrong while fetching your order history. Please try again.'
          }
          actionLabel={authExpired ? 'Sign in' : 'Try again'}
          onAction={() => (authExpired ? navigate('/login') : void reload())}
        >
          {!authExpired ? <p style={styles.errorDetail}>{error}</p> : null}
        </EmptyState>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No orders yet"
          description="When you place a COD order, it will show up here with status updates."
          actionLabel="Shop now"
          onAction={() => navigate('/shop')}
        />
      ) : (
        <div style={styles.list}>
          {error ? (
            <Banner tone="warning">
              Couldn’t refresh fully. Showing your last loaded orders.{' '}
              <button type="button" style={styles.linkBtn} onClick={() => void reload()}>
                Retry
              </button>
            </Banner>
          ) : null}
          {orders.map((o) => (
            <button
              key={o.orderId}
              type="button"
              style={styles.cardButton}
              onClick={() => navigate(`/orders/${o.orderId}`)}
            >
              <Card elevated style={styles.card}>
                <div style={styles.top}>
                  <div>
                    <p style={styles.name}>{o.orderNumber}</p>
                    {o.placedAt ? <p style={styles.when}>{formatWhen(o.placedAt)}</p> : null}
                  </div>
                  <Badge tone={statusTone(o.displayStatus || o.status)}>{o.displayStatus || o.status}</Badge>
                </div>
                <p style={styles.meta}>
                  <strong style={styles.amount}>₹{Number(o.totalAmount).toFixed(2)}</strong>
                  {' · '}
                  {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                </p>
                <p style={styles.meta}>Payment: {o.paymentStatus}</p>
                <p style={styles.viewHint}>View items & invoice →</p>
              </Card>
            </button>
          ))}
          <Button variant="ghost" onClick={() => navigate('/shop')}>
            Continue shopping
          </Button>
        </div>
      )}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  list: { display: 'grid', gap: '0.75rem' },
  cardButton: {
    display: 'block',
    width: '100%',
    padding: 0,
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
  },
  card: { display: 'grid', gap: '0.35rem' },
  top: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' },
  name: { margin: 0, fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '1.1rem' },
  when: { margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' },
  meta: { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' },
  amount: { color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: '1.05rem' },
  viewHint: { margin: '0.35rem 0 0', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 700 },
  errorDetail: { margin: '0.35rem 0 0', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
};
