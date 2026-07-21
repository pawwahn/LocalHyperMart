import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { Banner, EmptyState, LoadingBlock } from '@/shared/ui';
import { useShop } from '../hooks/useShop';
import { useWallet } from '../hooks/useWallet';
import type { WalletTransactionDto } from '../api/shopApi';

const PAGE_SIZE = 25;

function money(n: number): string {
  return `₹${n.toFixed(2)}`;
}

function formatWhen(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function shortTitle(tx: WalletTransactionDto): string {
  const raw =
    tx.title?.trim() || tx.note?.trim() || (tx.type === 'CREDIT' ? 'Credit added' : 'Credit used');
  return raw
    .replace(/^Store credit added\s*[—–-]\s*/i, 'Credit · ')
    .replace(/^Store credit used\s*[—–-]\s*/i, 'Used · ')
    .replace(/^Store credit added\s*/i, 'Credit · ')
    .replace(/^Store credit used\s*/i, 'Used · ');
}

export function WalletPage() {
  const { cart } = useShop();
  const { balance, transactions, loading, error, reload } = useWallet();
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((tx) => {
      const hay = `${txnTitle(tx)} ${tx.note ?? ''} ${tx.amount ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [transactions, query]);

  const shown = filtered.slice(0, visible);
  const remaining = Math.max(0, filtered.length - shown.length);

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
        <Banner tone="warning">Couldn’t refresh fully. Showing your last loaded balance.</Banner>
      ) : null}

      <div style={styles.balanceBar}>
        <div>
          <p style={styles.balanceLabel}>Store credit</p>
          {loading ? (
            <LoadingBlock label="Loading…" />
          ) : (
            <p style={styles.balanceAmount}>{money(balance)}</p>
          )}
        </div>
        <p style={styles.balanceHint}>
          Auto-applied at checkout ·{' '}
          <Link to="/cart" style={styles.link}>
            Cart
          </Link>
        </p>
      </div>

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h2 style={styles.h2}>Activity</h2>
          {transactions.length > 0 ? (
            <span style={styles.count}>{filtered.length} shown</span>
          ) : null}
        </div>

        {transactions.length > 0 ? (
          <input
            style={styles.search}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search activity…"
            aria-label="Search wallet activity"
          />
        ) : null}

        {loading && transactions.length === 0 ? (
          <LoadingBlock label="Loading activity…" />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Cancel credits and checkout usage show up here."
          />
        ) : filtered.length === 0 ? (
          <p style={styles.emptyFilter}>No matches for “{query.trim()}”.</p>
        ) : (
          <>
            <div style={styles.ledger}>
              {shown.map((tx, index) => {
                const credit = (tx.type ?? '').toUpperCase() === 'CREDIT';
                return (
                  <div
                    key={tx.id}
                    style={{
                      ...styles.row,
                      borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <div style={styles.rowMain}>
                      <p style={styles.rowTitle}>{shortTitle(tx)}</p>
                      <p style={styles.rowMeta}>{formatWhen(tx.createdAt)}</p>
                    </div>
                    <div style={styles.rowSide}>
                      <p style={credit ? styles.credit : styles.debit}>
                        {credit ? '+' : '−'}
                        {money(Number(tx.amount ?? 0))}
                      </p>
                      <p style={styles.rowMeta}>{money(Number(tx.balanceAfter ?? 0))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {remaining > 0 ? (
              <button
                type="button"
                style={styles.moreBtn}
                onClick={() => setVisible((n) => n + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, remaining)} more · {remaining} left
              </button>
            ) : null}
          </>
        )}
      </section>
    </PortalShell>
  );
}

function txnTitle(tx: WalletTransactionDto): string {
  return tx.title?.trim() || tx.note?.trim() || (tx.type === 'CREDIT' ? 'Credit added' : 'Credit used');
}

const styles: Record<string, CSSProperties> = {
  balanceBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    background:
      'linear-gradient(145deg, color-mix(in srgb, var(--accent) 14%, var(--bg-elevated)), var(--bg-elevated))',
  },
  balanceLabel: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  balanceAmount: {
    margin: '0.05rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.45rem',
    fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  balanceHint: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    lineHeight: 1.3,
  },
  link: { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' },
  section: { display: 'grid', gap: '0.45rem' },
  sectionHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  h2: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    fontWeight: 800,
  },
  count: { color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.55rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    fontSize: '0.88rem',
  },
  emptyFilter: { margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' },
  ledger: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.6rem',
    padding: '0.45rem 0.7rem',
    alignItems: 'center',
  },
  rowMain: { display: 'grid', gap: '0.05rem', minWidth: 0 },
  rowTitle: {
    margin: 0,
    fontWeight: 650,
    color: 'var(--text)',
    fontSize: '0.84rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rowMeta: { margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 },
  rowSide: { display: 'grid', gap: '0.02rem', textAlign: 'right', flexShrink: 0 },
  credit: { margin: 0, fontWeight: 800, color: 'var(--accent)', fontSize: '0.86rem' },
  debit: { margin: 0, fontWeight: 800, color: 'var(--text)', fontSize: '0.86rem' },
  moreBtn: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--accent-hover)',
    borderRadius: 'var(--radius-full)',
    padding: '0.45rem 0.9rem',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    justifySelf: 'center',
  },
};
