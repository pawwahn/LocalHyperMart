import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyOrders, reorderOrder, type OrderSummaryDto } from '../api/shopApi';
import { markBuyAgainKept } from '../lib/buyAgainKeep';

type Props = {
  townId: string;
  token: string;
  busy?: boolean;
  onMessage: (message: string) => void | Promise<void>;
  onError: (message: string) => void;
};

export function BuyAgainBar({ townId, token, busy = false, onMessage, onError }: Props) {
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderSummaryDto | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listMyOrders(token, townId)
      .then((orders) => {
        if (cancelled) return;
        const next = orders.find((row) => row.status === 'PLACED' || row.status === 'DELIVERED') ?? null;
        setOrder(next);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId]);

  if (!order) return null;

  async function buyAgain() {
    if (!order || working || busy) return;
    setWorking(true);
    onError('');
    markBuyAgainKept(order.orderId);
    try {
      const result = await reorderOrder(token, order.orderId);
      const skipped = result.skippedItemNames ?? [];
      const parts = [
        `Added ${result.itemCount} item${result.itemCount === 1 ? '' : 's'} from ${order.orderNumber}.`,
      ];
      if (result.priceChanged) parts.push('Prices were updated.');
      if (skipped.length > 0) {
        parts.push(`${skipped.join(', ')} ${skipped.length === 1 ? 'is' : 'are'} no longer sold.`);
      }
      await onMessage(parts.join(' '));
      navigate('/cart');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not buy that order again');
    } finally {
      setWorking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void buyAgain()}
      disabled={working || busy}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.45rem',
        width: '100%',
        minHeight: 44,
        margin: 0,
        padding: '0.4rem 0.65rem',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--bg-elevated)',
        color: 'var(--text)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800 }}>Buy again</span>
        <span
          style={{
            display: 'block',
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {order.orderNumber} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
        </span>
      </span>
      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0C831F', flexShrink: 0 }}>
        {working ? 'Adding…' : 'Add'}
      </span>
    </button>
  );
}
