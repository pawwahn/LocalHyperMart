import { useEffect, type CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import { useShop } from '../hooks/useShop';
import { useWallet } from '../hooks/useWallet';
import type { WalletTransactionDto } from '../api/shopApi';

function money(n: number): string {
  return `₹${n.toFixed(2)}`;
}

function formatDay(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

function shortTitle(tx: WalletTransactionDto): string {
  const ref = (tx.referenceType ?? '').toUpperCase();
  if (ref === 'ORDER_CHECKOUT') return 'Checkout';
  if (ref === 'ORDER_ITEM_CANCEL') return 'Cancelled';
  if (ref === 'ORDER_ITEM_RESTORE') return 'Restored';

  const raw = (tx.title ?? tx.note ?? '').trim().toLowerCase();
  if (raw.includes('checkout')) return 'Checkout';
  if (raw.includes('cancelled') || raw.includes('canceled')) return 'Cancelled';
  if (raw.includes('restored') || raw.includes('backfill')) return 'Restored';
  if (raw === 'test') return 'Test';
  return tx.type === 'CREDIT' ? 'Credit' : 'Used';
}

function rowLabel(tx: WalletTransactionDto): string {
  const parts = [shortTitle(tx)];
  if (tx.orderNumber) parts.push(tx.orderNumber);
  const day = formatDay(tx.createdAt);
  if (day) parts.push(day);
  return parts.join(' · ');
}

export function WalletPage() {
  const { cart } = useShop();
  const { balance, transactions, hasMore, loading, loadingMore, error, reload, loadMore } =
    useWallet();

  // Always refresh when opening Wallet so balance matches recent cancel credits.
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <PortalShell
      title="Wallet"
      onRefresh={() => void reload()}
      cartCount={cart?.itemCount ?? 0}
      cartTotalLabel={cart?.payableLabel}
      showDeliveryBanner={false}
    >
      {error && balance <= 0 && loading ? <Banner tone="danger">{error}</Banner> : null}
      {error && !loading ? (
        <Banner tone="warning">Couldn’t refresh fully. Showing last balance.</Banner>
      ) : null}

      <div style={styles.balance}>
        <p style={styles.balanceLabel}>Store credit</p>
        {loading && transactions.length === 0 ? (
          <LoadingBlock label="Loading…" />
        ) : (
          <p style={styles.balanceAmount}>{money(balance)}</p>
        )}
      </div>

      {loading && transactions.length === 0 ? (
        <LoadingBlock label="Loading…" />
      ) : transactions.length === 0 ? (
        <EmptyState title="No activity yet" description="Credits and checkout usage show up here." />
      ) : (
        <>
          <div style={styles.list}>
            {transactions.map((tx, index) => {
              const credit = (tx.type ?? '').toUpperCase() === 'CREDIT';
              return (
                <div
                  key={tx.id}
                  style={{
                    ...styles.row,
                    borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <p style={styles.label} title={tx.orderNumber ?? undefined}>
                    {rowLabel(tx)}
                  </p>
                  <p style={credit ? styles.credit : styles.debit}>
                    {credit ? '+' : '−'}
                    {money(Number(tx.amount ?? 0))}
                  </p>
                </div>
              );
            })}
          </div>
          {hasMore ? (
            <button
              type="button"
              style={styles.moreBtn}
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? 'Loading…' : 'More'}
            </button>
          ) : null}
        </>
      )}
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  balance: {
    padding: '0.35rem 0 0.85rem',
  },
  balanceLabel: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  balanceAmount: {
    margin: '0.1rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  list: {
    borderTop: '1px solid var(--border)',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.75rem',
    padding: '0.55rem 0',
  },
  label: {
    margin: 0,
    minWidth: 0,
    color: 'var(--text)',
    fontSize: '0.86rem',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  credit: { margin: 0, fontWeight: 800, color: 'var(--accent)', fontSize: '0.9rem', flexShrink: 0 },
  debit: { margin: 0, fontWeight: 800, color: 'var(--text)', fontSize: '0.9rem', flexShrink: 0 },
  moreBtn: {
    marginTop: '0.35rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--accent-hover)',
    padding: '0.4rem 0',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
};
