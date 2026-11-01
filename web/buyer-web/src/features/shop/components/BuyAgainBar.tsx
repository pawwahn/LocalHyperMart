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

function orderSubtitle(order: OrderSummaryDto): string {
  const n = order.itemCount;
  const items = `${n} item${n === 1 ? '' : 's'}`;
  const raw = order.placedAt ?? order.createdAt;
  if (!raw) return `Your last order · ${items}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return `Your last order · ${items}`;
  const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
  const status = order.displayStatus?.trim() || (order.status === 'DELIVERED' ? 'Delivered' : 'Ordered');
  return `${status} ${when} · ${items}`;
}

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
        `Added ${result.itemCount} item${result.itemCount === 1 ? '' : 's'} from your last order.`,
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.55rem',
        width: '100%',
        minHeight: 48,
        padding: '0.45rem 0.55rem',
        border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))',
        borderRadius: 12,
        background: 'color-mix(in srgb, var(--accent-soft) 55%, var(--bg-elevated))',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Repeat last order
        </span>
        <span
          style={{
            display: 'block',
            fontSize: '0.68rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {orderSubtitle(order)}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void buyAgain()}
        disabled={working || busy}
        style={{
          flexShrink: 0,
          minHeight: 36,
          padding: '0 0.85rem',
          border: 'none',
          borderRadius: 999,
          background: 'var(--accent)',
          color: 'var(--text-inverse)',
          fontSize: '0.72rem',
          fontWeight: 600,
          cursor: working || busy ? 'not-allowed' : 'pointer',
          opacity: working || busy ? 0.65 : 1,
        }}
      >
        {working ? 'Adding…' : 'Add all'}
      </button>
    </div>
  );
}
