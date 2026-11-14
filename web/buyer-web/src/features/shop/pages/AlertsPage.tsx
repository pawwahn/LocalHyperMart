import { useEffect, useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import { useBuyerAlerts } from '../hooks/useBuyerAlerts';
import { buyerOrderPath, isNotificationUnread } from '../lib/buyerAlertsState';
import type { BuyerNotificationDto } from '../api/notificationsApi';

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
  if (c === 'PUSH') return 'In-app';
  return channel;
}

function eventTitle(code: string): string {
  switch (code) {
    case 'ORDER_PLACED':
      return 'Order placed';
    case 'ORDER_STATUS_UPDATED':
      return 'Order update';
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

function rowIsUnread(n: BuyerNotificationDto, globalSeenAt: number): boolean {
  return isNotificationUnread(n, globalSeenAt);
}

export function AlertsPage() {
  const { items, loading, reload, markAllSeen, globalSeenAt } = useBuyerAlerts();

  useEffect(() => {
    const id = window.setTimeout(() => markAllSeen(), 600);
    return () => window.clearTimeout(id);
  }, [markAllSeen]);

  const empty = !loading && items.length === 0;

  const list = useMemo(
    () =>
      items.map((n) => ({
        n,
        unread: rowIsUnread(n, globalSeenAt),
      })),
    [items, globalSeenAt],
  );

  return (
    <PortalShell
      title="Alerts"
      subtitle="Updates on grocery, glam, laundry, and diagnostics bookings."
      onRefresh={reload}
      showDeliveryBanner={false}
    >
      {loading && items.length === 0 ? (
        <LoadingBlock label="Loading alerts…" />
      ) : empty ? (
        <EmptyState
          title="No alerts yet"
          description="When an order moves forward, you'll see it here and on the bell icon."
        />
      ) : (
        <ul style={styles.list}>
          {list.map(({ n, unread }) => (
            <li key={n.id} style={{ ...styles.row, ...(unread ? styles.rowUnread : null) }}>
              <div style={styles.rowTop}>
                <span style={styles.title}>
                  {eventTitle(n.eventCode)}
                  {unread ? <span style={styles.newDot} aria-label="New" /> : null}
                </span>
                <span style={styles.meta}>
                  {channelLabel(n.channel)} · {formatWhen(n.createdAt)}
                </span>
              </div>
              <p style={styles.body}>{n.body || '—'}</p>
              {n.orderId ? (
                <Link to={buyerOrderPath(n.orderId, n.body)} style={styles.link}>
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
  rowUnread: {
    borderColor: 'color-mix(in srgb, #dc2626 35%, var(--border))',
    background: 'color-mix(in srgb, #fef2f2 50%, var(--bg-elevated))',
  },
  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  title: {
    fontWeight: 800,
    fontFamily: 'var(--font-display)',
    fontSize: '0.95rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 'var(--radius-full)',
    background: '#dc2626',
    flexShrink: 0,
  },
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
