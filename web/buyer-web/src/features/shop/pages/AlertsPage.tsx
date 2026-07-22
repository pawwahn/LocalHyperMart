import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { listMyNotifications, type BuyerNotificationDto } from '../api/notificationsApi';

function formatWhen(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function channelLabel(channel: string): string {
  const c = channel.toUpperCase();
  if (c === 'SMS') return 'SMS';
  if (c === 'PUSH') return 'Push';
  return channel;
}

function eventTitle(code: string): string {
  switch (code) {
    case 'ORDER_PLACED':
      return 'Order placed';
    case 'SUB_ORDER_READY':
      return 'Shop ready';
    case 'ORDER_AT_HUB':
      return 'At delivery hub';
    case 'OUT_FOR_DELIVERY':
      return 'Out for delivery';
    case 'ORDER_DELIVERED':
      return 'Delivered';
    case 'ORDER_CANCELLED':
      return 'Cancelled';
    case 'PAYMENT_FAILED':
      return 'Payment failed';
    case 'REFUND_INITIATED':
      return 'Refund started';
    case 'ITEM_CANCELLED_STORE_CREDIT':
      return 'Item cancelled';
    case 'ITEM_RESTORED':
      return 'Item restored';
    case 'BUYER_REJECTED':
      return 'Delivery rejected';
    default:
      return code.replaceAll('_', ' ');
  }
}

export function AlertsPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<BuyerNotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listMyNotifications(session.accessToken, 50);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load alerts');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <PortalShell
      title="Alerts"
      subtitle="Order updates sent to you (SMS / push stub until live providers)."
      onRefresh={reload}
      showDeliveryBanner={false}
      showStickyCart={false}
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading && items.length === 0 ? (
        <LoadingBlock label="Loading alerts…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No alerts yet"
          description="When your order status changes, updates will show up here."
        />
      ) : (
        <ul style={styles.list}>
          {items.map((n) => (
            <li key={n.id} style={styles.row}>
              <div style={styles.rowTop}>
                <span style={styles.title}>{eventTitle(n.eventCode)}</span>
                <span style={styles.meta}>
                  {channelLabel(n.channel)} · {formatWhen(n.createdAt)}
                </span>
              </div>
              <p style={styles.body}>{n.body || '—'}</p>
              {n.orderId ? (
                <Link to={`/orders/${n.orderId}`} style={styles.link}>
                  View order
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.65rem' },
  row: {
    padding: '0.85rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    display: 'grid',
    gap: '0.35rem',
  },
  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  title: { fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '0.95rem' },
  meta: { color: 'var(--text-muted)', fontSize: '0.75rem' },
  body: { margin: 0, fontSize: '0.88rem', lineHeight: 1.45, color: 'var(--text)' },
  link: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--accent-hover)',
    textDecoration: 'none',
    width: 'fit-content',
  },
};
