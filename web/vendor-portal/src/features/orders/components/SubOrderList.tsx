import type { CSSProperties } from 'react';
import { Button, Card } from '@/shared/ui';
import type { SubOrderView } from '../api/ordersApi';

type Props = {
  orders: SubOrderView[];
  actionId: string | null;
  onReady: (id: string) => void;
  onReject: (id: string) => void;
};

export function SubOrderList({ orders, actionId, onReady, onReject }: Props) {
  if (orders.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <p style={styles.emptyTitle}>No sub-orders for this filter</p>
        <p style={styles.empty}>New PLACED orders will appear here for packing.</p>
      </Card>
    );
  }

  return (
    <div style={styles.list}>
      {orders.map((order) => {
        const busy = actionId === order.id;
        const canAct = order.status === 'PLACED';
        return (
          <Card key={order.id} elevated style={styles.row}>
            <div>
              <p style={styles.orderNo}>{order.subOrderNumber}</p>
              <p style={styles.meta}>Parent {order.orderNumber}</p>
              <p style={styles.meta}>{order.itemSummary}</p>
              <p style={styles.meta}>
                <span style={styles.badge}>{order.status}</span> · {order.subtotalLabel}
              </p>
            </div>
            {canAct ? (
              <div style={styles.actions}>
                <Button size="sm" disabled={busy} onClick={() => onReady(order.id)}>
                  {busy ? '…' : 'Mark ready'}
                </Button>
                <Button variant="danger" size="sm" disabled={busy} onClick={() => onReject(order.id)}>
                  Reject
                </Button>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  list: { display: 'grid', gap: '0.75rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  orderNo: { margin: 0, fontWeight: 800, fontSize: '1.05rem', fontFamily: 'var(--font-display)' },
  meta: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' },
  badge: {
    display: 'inline-block',
    padding: '0.15rem 0.55rem',
    borderRadius: 'var(--radius-full)',
    background: 'var(--accent-soft)',
    color: 'var(--accent-hover)',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  actions: { display: 'flex', gap: '0.5rem' },
  emptyCard: { textAlign: 'center', padding: '1.75rem' },
  emptyTitle: { margin: 0, fontWeight: 700, fontFamily: 'var(--font-display)' },
  empty: { margin: '0.35rem 0 0', color: 'var(--text-muted)' },
};
