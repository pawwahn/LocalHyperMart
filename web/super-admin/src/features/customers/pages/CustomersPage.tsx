import { useCallback, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button } from '@/shared/ui';
import {
  formatWhen as formatOrderWhen,
  listAdminOrders,
  money as orderMoney,
  shortOrderNo,
  type AdminOrderSummary,
} from '@/features/orders/api/ordersApi';
import {
  displayName,
  fetchCustomerWallet,
  fetchCustomerWalletTxns,
  findCustomerByPhone,
  formatWhen,
  listCustomerAddresses,
  money,
  type CustomerAddress,
  type CustomerProfile,
  type CustomerWallet,
  type CustomerWalletTxn,
} from '../api/customersApi';

const PAGE = 15;

type Tab = 'overview' | 'addresses' | 'wallet' | 'orders';

const TABS: Array<{ id: Tab; label: string; emoji: string }> = [
  { id: 'overview', label: 'Overview', emoji: '👤' },
  { id: 'addresses', label: 'Addresses', emoji: '🏠' },
  { id: 'wallet', label: 'Wallet', emoji: '💳' },
  { id: 'orders', label: 'Orders', emoji: '📦' },
];

function shortTxnTitle(tx: CustomerWalletTxn): string {
  const raw = (tx.title ?? tx.note ?? '').trim();
  const lower = raw.toLowerCase();
  if (lower.includes('checkout')) return 'Checkout';
  if (lower.includes('cancelled') || lower.includes('canceled')) return 'Item cancelled';
  if (lower.includes('restored')) return 'Item restored';
  if (lower.includes('claim')) return 'Claim credit';
  if (lower.includes('backfill')) return 'Credit restored';
  if (!raw) return (tx.type ?? '').toUpperCase() === 'CREDIT' ? 'Credit' : 'Used';
  return raw.length > 42 ? `${raw.slice(0, 40)}…` : raw;
}

function statusTone(status: string): CSSProperties {
  const s = status.toUpperCase();
  if (s === 'DELIVERED' || s === 'ACTIVE' || s === 'RESOLVED') {
    return { ...styles.pill, color: '#0C831F', background: '#E7F6EC' };
  }
  if (s === 'CANCELLED' || s === 'REJECTED' || s === 'PAYMENT_FAILED') {
    return { ...styles.pill, color: '#E03546', background: '#FDE8EA' };
  }
  if (s === 'PLACED' || s === 'OPEN') {
    return { ...styles.pill, color: '#9A5F10', background: '#FFF3DF' };
  }
  return { ...styles.pill, color: 'var(--text-muted)', background: 'var(--bg-muted)' };
}

function Pager({
  page,
  totalPages,
  total,
  loading,
  onPrev,
  onNext,
  canNext,
}: {
  page: number;
  totalPages: number;
  total?: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  canNext?: boolean;
}) {
  const nextEnabled = canNext ?? (totalPages > 0 && page + 1 < totalPages);
  if (totalPages <= 1 && !nextEnabled && page === 0) return null;
  return (
    <div style={styles.pager}>
      <button
        type="button"
        style={page <= 0 || loading ? styles.pagerBtnDisabled : styles.pagerBtn}
        disabled={page <= 0 || loading}
        onClick={onPrev}
        aria-label="Previous page"
      >
        ‹
      </button>
      <span style={styles.pagerMeta}>
        {page + 1}
        {totalPages > 0 ? ` / ${Math.max(totalPages, page + 1)}` : ''}
        {total != null ? ` · ${total}` : ''}
      </span>
      <button
        type="button"
        style={!nextEnabled || loading ? styles.pagerBtnDisabled : styles.pagerBtn}
        disabled={!nextEnabled || loading}
        onClick={onNext}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}

function SoftCard({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={className} style={{ ...styles.softCard, ...style }}>
      {children}
    </div>
  );
}

function TableShell({ children, minWidth }: { children: ReactNode; minWidth?: string }) {
  return (
    <SoftCard style={{ padding: 0, overflow: 'hidden' }}>
      <div style={styles.tableScroll}>
        <table style={{ ...styles.table, minWidth: minWidth ?? '36rem' }}>{children}</table>
      </div>
    </SoftCard>
  );
}

export function CustomersPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';

  const [phoneDraft, setPhoneDraft] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);

  const [txns, setTxns] = useState<CustomerWalletTxn[]>([]);
  const [txnPage, setTxnPage] = useState(0);
  const [txnHasMore, setTxnHasMore] = useState(false);
  const [txnLoading, setTxnLoading] = useState(false);

  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [orderPage, setOrderPage] = useState(0);
  const [orderTotalPages, setOrderTotalPages] = useState(0);
  const [orderTotal, setOrderTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [addrPage, setAddrPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const loadWalletPage = useCallback(
    async (userId: string, page: number) => {
      if (!token) return;
      setTxnLoading(true);
      try {
        const data = await fetchCustomerWalletTxns(token, userId, {
          limit: PAGE,
          offset: page * PAGE,
        });
        setTxns(data.items ?? []);
        setTxnPage(page);
        setTxnHasMore(Boolean(data.hasMore));
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load wallet');
      } finally {
        setTxnLoading(false);
      }
    },
    [token],
  );

  const loadOrdersPage = useCallback(
    async (userId: string, page: number) => {
      if (!token) return;
      setOrdersLoading(true);
      try {
        const data = await listAdminOrders(token, { buyerId: userId, page, size: PAGE });
        setOrders(data.items ?? []);
        setOrderPage(data.page ?? page);
        setOrderTotalPages(data.totalPages ?? 0);
        setOrderTotal(data.totalElements ?? 0);
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load orders');
      } finally {
        setOrdersLoading(false);
      }
    },
    [token],
  );

  const loadCustomer = useCallback(
    async (phone: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      setSearched(true);
      setTab('overview');
      setCustomer(null);
      setAddresses([]);
      setWallet(null);
      setTxns([]);
      setTxnPage(0);
      setTxnHasMore(false);
      setOrders([]);
      setOrderPage(0);
      setOrderTotalPages(0);
      setOrderTotal(0);
      setAddrPage(0);
      try {
        const profile = await findCustomerByPhone(token, phone);
        setCustomer(profile);
        const [addr, bal, ledger, orderData] = await Promise.all([
          listCustomerAddresses(token, profile.id).catch(() => [] as CustomerAddress[]),
          fetchCustomerWallet(token, profile.id).catch(() => null),
          fetchCustomerWalletTxns(token, profile.id, { limit: PAGE, offset: 0 }).catch(() => ({
            items: [] as CustomerWalletTxn[],
            hasMore: false,
          })),
          listAdminOrders(token, { buyerId: profile.id, page: 0, size: PAGE }).catch(() => ({
            items: [] as AdminOrderSummary[],
            page: 0,
            size: PAGE,
            totalElements: 0,
            totalPages: 0,
          })),
        ]);
        setAddresses(addr);
        setWallet(bal);
        setTxns(ledger.items ?? []);
        setTxnHasMore(Boolean(ledger.hasMore));
        setOrders(orderData.items ?? []);
        setOrderPage(orderData.page ?? 0);
        setOrderTotalPages(orderData.totalPages ?? 0);
        setOrderTotal(orderData.totalElements ?? 0);
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Customer not found');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const phone = phoneDraft.trim().replace(/\s+/g, '');
    if (!phone) {
      setError('Enter a phone number');
      return;
    }
    void loadCustomer(phone);
  }

  const addrPages = Math.max(1, Math.ceil(addresses.length / PAGE));
  const addrSlice = addresses.slice(addrPage * PAGE, addrPage * PAGE + PAGE);

  return (
    <PortalShell
      title="Customers"
      onRefresh={customer ? () => void loadCustomer(customer.phone) : undefined}
    >
      <style>{responsiveCss}</style>

      <form className="cust-search" style={styles.searchShell} onSubmit={onSearch}>
        <span style={styles.searchIcon} aria-hidden>
          ⌕
        </span>
        <input
          className="cust-search-input"
          style={styles.searchInput}
          value={phoneDraft}
          onChange={(e) => setPhoneDraft(e.target.value)}
          placeholder="Search customer by phone"
          inputMode="tel"
          aria-label="Customer phone"
        />
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? '…' : 'Search'}
        </Button>
      </form>

      {error ? (
        <div style={styles.bannerWrap}>
          <Banner tone="danger">{error}</Banner>
        </div>
      ) : null}

      {!searched && !loading ? (
        <SoftCard style={styles.emptyHero}>
          <p style={styles.emptyEmoji} aria-hidden>
            🛒
          </p>
          <p style={styles.emptyTitle}>Find a customer</p>
          <p style={styles.emptyText}>Search by phone to see profile, wallet, addresses, and orders.</p>
        </SoftCard>
      ) : null}

      {customer ? (
        <div style={styles.page}>
          <SoftCard className="cust-hero" style={styles.hero}>
            <div style={styles.heroMain}>
              <p style={styles.eyebrow}>Customer</p>
              <p style={styles.name}>{displayName(customer)}</p>
              <p style={styles.metaLine}>
                <a href={`tel:${customer.phone}`} style={styles.phoneLink}>
                  {customer.phone}
                </a>
                <span style={styles.dot}>·</span>
                <span style={statusTone(customer.status ?? '')}>{customer.status ?? '—'}</span>
              </p>
            </div>
            <div className="cust-credit" style={styles.creditTile}>
              <p style={styles.creditLabel}>Store credit</p>
              <p style={styles.creditAmt}>{money(Number(wallet?.balance ?? 0))}</p>
            </div>
          </SoftCard>

          <div className="cust-tabs hlm-hide-scrollbar" style={styles.tabs} role="tablist">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  style={active ? styles.tabActive : styles.tab}
                  onClick={() => {
                    setTab(t.id);
                    if (t.id === 'addresses') setAddrPage(0);
                  }}
                >
                  <span style={active ? styles.tabEmojiActive : styles.tabEmoji} aria-hidden>
                    {t.emoji}
                  </span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div role="tabpanel">
            {tab === 'overview' ? (
              <div className="cust-overview" style={styles.overviewGrid}>
                <button type="button" style={styles.tile} onClick={() => setTab('orders')}>
                  <span style={{ ...styles.tileMedia, background: '#FFF3DF' }} aria-hidden>
                    📦
                  </span>
                  <span style={styles.tileLabel}>Orders</span>
                  <span style={styles.tileValue}>{orderTotal}</span>
                </button>
                <button type="button" style={styles.tile} onClick={() => setTab('wallet')}>
                  <span style={{ ...styles.tileMedia, background: '#E7F6EC' }} aria-hidden>
                    💳
                  </span>
                  <span style={styles.tileLabel}>Store credit</span>
                  <span style={styles.tileValue}>{money(Number(wallet?.balance ?? 0))}</span>
                </button>
                <button type="button" style={styles.tile} onClick={() => setTab('addresses')}>
                  <span style={{ ...styles.tileMedia, background: '#EEF1F4' }} aria-hidden>
                    🏠
                  </span>
                  <span style={styles.tileLabel}>Addresses</span>
                  <span style={styles.tileValue}>{addresses.length}</span>
                </button>

                <SoftCard style={{ gridColumn: '1 / -1' }}>
                  <p style={styles.sectionTitle}>Profile</p>
                  <div className="cust-profile" style={styles.profileGrid}>
                    <div>
                      <p style={styles.k}>Name</p>
                      <p style={styles.v}>{displayName(customer)}</p>
                    </div>
                    <div>
                      <p style={styles.k}>Phone</p>
                      <a href={`tel:${customer.phone}`} style={styles.phoneLink}>
                        {customer.phone}
                      </a>
                    </div>
                    <div>
                      <p style={styles.k}>Status</p>
                      <p style={styles.v}>{customer.status ?? '—'}</p>
                    </div>
                    <div>
                      <p style={styles.k}>Roles</p>
                      <p style={styles.v}>{customer.roles?.join(', ') || '—'}</p>
                    </div>
                    <div>
                      <p style={styles.k}>Email</p>
                      <p style={styles.v}>{customer.email || '—'}</p>
                    </div>
                    <div>
                      <p style={styles.k}>Last seen</p>
                      <p style={styles.v}>{formatWhen(customer.lastLoginAt)}</p>
                    </div>
                  </div>
                </SoftCard>
              </div>
            ) : null}

            {tab === 'addresses' ? (
              addresses.length === 0 ? (
                <SoftCard>
                  <p style={styles.emptyText}>No saved addresses.</p>
                </SoftCard>
              ) : (
                <>
                  <TableShell minWidth="34rem">
                    <thead>
                      <tr>
                        <th style={styles.th}>Recipient</th>
                        <th style={styles.th}>Phone</th>
                        <th style={styles.th}>Address</th>
                        <th style={styles.th}>Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addrSlice.map((a) => (
                        <tr key={a.id}>
                          <td style={styles.td}>
                            <strong>{a.recipientName || '—'}</strong>
                            {a.isDefault ? <span style={styles.defaultTag}>Default</span> : null}
                          </td>
                          <td style={styles.td}>
                            {a.recipientPhone ? (
                              <a href={`tel:${a.recipientPhone}`} style={styles.phoneLink}>
                                {a.recipientPhone}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={styles.tdMuted}>
                            {[a.line1, a.line2, a.landmark, a.pincode].filter(Boolean).join(', ')}
                          </td>
                          <td style={styles.tdMuted}>{a.label || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </TableShell>
                  <Pager
                    page={addrPage}
                    totalPages={addrPages}
                    total={addresses.length}
                    onPrev={() => setAddrPage((p) => Math.max(0, p - 1))}
                    onNext={() => setAddrPage((p) => Math.min(addrPages - 1, p + 1))}
                  />
                </>
              )
            ) : null}

            {tab === 'wallet' ? (
              txns.length === 0 && !txnLoading ? (
                <SoftCard>
                  <p style={styles.emptyText}>No wallet activity.</p>
                </SoftCard>
              ) : (
                <>
                  <TableShell minWidth="40rem">
                    <thead>
                      <tr>
                        <th style={styles.th}>Activity</th>
                        <th style={styles.th}>Order</th>
                        <th style={styles.th}>When</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map((tx) => {
                        const credit = (tx.type ?? '').toUpperCase() === 'CREDIT';
                        return (
                          <tr key={tx.id}>
                            <td style={styles.td}>
                              <strong>{shortTxnTitle(tx)}</strong>
                            </td>
                            <td style={styles.tdMuted}>
                              {tx.orderNumber ? shortOrderNo(tx.orderNumber) : '—'}
                            </td>
                            <td style={styles.tdMuted}>{formatWhen(tx.createdAt)}</td>
                            <td
                              style={{
                                ...styles.td,
                                textAlign: 'right',
                                fontWeight: 800,
                                color: credit ? 'var(--accent)' : 'var(--text)',
                              }}
                            >
                              {credit ? '+' : '−'}
                              {money(Number(tx.amount ?? 0))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </TableShell>
                  <Pager
                    page={txnPage}
                    totalPages={txnHasMore ? txnPage + 2 : txnPage + 1}
                    loading={txnLoading}
                    canNext={txnHasMore}
                    onPrev={() => {
                      if (customer && txnPage > 0) void loadWalletPage(customer.id, txnPage - 1);
                    }}
                    onNext={() => {
                      if (customer && txnHasMore) void loadWalletPage(customer.id, txnPage + 1);
                    }}
                  />
                </>
              )
            ) : null}

            {tab === 'orders' ? (
              orders.length === 0 && !ordersLoading ? (
                <SoftCard>
                  <p style={styles.emptyText}>No orders yet.</p>
                </SoftCard>
              ) : (
                <>
                  <TableShell minWidth="42rem">
                    <thead>
                      <tr>
                        <th style={styles.th}>Order</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Payment</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                        <th style={styles.th}>Placed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.orderId}>
                          <td style={styles.td}>
                            {o.townId ? (
                              <Link
                                to={`/orders/${o.orderId}?townId=${encodeURIComponent(o.townId)}`}
                                style={styles.orderLink}
                                title={o.orderNumber}
                              >
                                {shortOrderNo(o.orderNumber)}
                              </Link>
                            ) : (
                              <strong>{shortOrderNo(o.orderNumber)}</strong>
                            )}
                          </td>
                          <td style={styles.td}>
                            <span style={statusTone(o.status)}>{o.status}</span>
                          </td>
                          <td style={styles.tdMuted}>{o.paymentStatus}</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800 }}>
                            {orderMoney(o.totalAmount)}
                          </td>
                          <td style={styles.tdMuted}>{formatOrderWhen(o.placedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </TableShell>
                  <Pager
                    page={orderPage}
                    totalPages={orderTotalPages}
                    total={orderTotal}
                    loading={ordersLoading}
                    onPrev={() => {
                      if (customer && orderPage > 0) void loadOrdersPage(customer.id, orderPage - 1);
                    }}
                    onNext={() => {
                      if (customer && orderPage + 1 < orderTotalPages) {
                        void loadOrdersPage(customer.id, orderPage + 1);
                      }
                    }}
                  />
                </>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}

const responsiveCss = `
  @media (max-width: 720px) {
    .cust-hero { flex-direction: column !important; align-items: stretch !important; }
    .cust-credit { width: 100%; text-align: left !important; }
    .cust-search { max-width: none !important; width: 100%; }
    .cust-overview { grid-template-columns: 1fr 1fr !important; }
    .cust-profile { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 420px) {
    .cust-overview { grid-template-columns: 1fr !important; }
  }
`;

const styles: Record<string, CSSProperties> = {
  searchShell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '0.2rem 0.75rem 0.2rem 0.95rem',
    boxShadow: 'var(--shadow-card)',
    marginBottom: '1rem',
    maxWidth: '28rem',
  },
  searchIcon: { color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 700 },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '0.8rem 0',
    fontSize: '0.95rem',
    color: 'var(--text)',
    minWidth: 0,
  },
  bannerWrap: { marginBottom: '0.75rem' },
  page: { display: 'grid', gap: '1rem' },
  softCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-card)',
    padding: '1rem 1.1rem',
  },
  emptyHero: { textAlign: 'center', padding: '2rem 1.25rem' },
  emptyEmoji: { margin: 0, fontSize: '2rem' },
  emptyTitle: {
    margin: '0.5rem 0 0.25rem',
    fontFamily: 'var(--font-display)',
    fontSize: '1.15rem',
    fontWeight: 800,
  },
  emptyText: { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.45 },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  heroMain: { minWidth: 0 },
  eyebrow: {
    margin: 0,
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  name: {
    margin: '0.2rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.55rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
  },
  metaLine: {
    margin: '0.4rem 0 0',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.84rem',
    fontWeight: 600,
  },
  dot: { color: 'var(--text-muted)', opacity: 0.5 },
  phoneLink: { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' },
  creditTile: {
    textAlign: 'right',
    background: 'var(--accent-soft)',
    borderRadius: 14,
    padding: '0.75rem 1rem',
    minWidth: '8.5rem',
  },
  creditLabel: {
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  creditAmt: {
    margin: '0.15rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: '1.45rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  tabs: {
    display: 'flex',
    gap: '0.45rem',
    overflowX: 'auto',
    paddingBottom: '0.15rem',
  },
  tab: {
    flex: '0 0 auto',
    display: 'grid',
    justifyItems: 'center',
    gap: '0.28rem',
    minWidth: 72,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '0.2rem',
  },
  tabActive: {
    flex: '0 0 auto',
    display: 'grid',
    justifyItems: 'center',
    gap: '0.28rem',
    minWidth: 72,
    border: 'none',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '0.72rem',
    fontWeight: 800,
    cursor: 'pointer',
    padding: '0.2rem',
  },
  tabEmoji: {
    width: 52,
    height: 52,
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.35rem',
    background: 'var(--bg-muted)',
    border: '1px solid transparent',
  },
  tabEmojiActive: {
    width: 52,
    height: 52,
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.35rem',
    background: 'var(--accent-soft)',
    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
  },
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.75rem',
  },
  tile: {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-card)',
    padding: '0.85rem',
    display: 'grid',
    gap: '0.45rem',
    justifyItems: 'start',
    cursor: 'pointer',
    textAlign: 'left',
  },
  tileMedia: {
    width: '100%',
    aspectRatio: '1.35 / 1',
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    fontSize: '1.75rem',
  },
  tileLabel: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' },
  tileValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.2rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  sectionTitle: {
    margin: '0 0 0.75rem',
    fontFamily: 'var(--font-display)',
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.85rem',
  },
  k: { margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 },
  v: { margin: '0.2rem 0 0', fontSize: '0.92rem', fontWeight: 650 },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.85rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.9rem',
    verticalAlign: 'middle',
    background: 'var(--bg-elevated)',
  },
  tdMuted: {
    padding: '0.85rem 1rem',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.86rem',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
    background: 'var(--bg-elevated)',
  },
  orderLink: { color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' },
  pill: {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 800,
  },
  defaultTag: {
    marginLeft: '0.4rem',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--accent-hover)',
    background: 'var(--accent-soft)',
    borderRadius: 999,
    padding: '0.1rem 0.45rem',
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.65rem',
    marginTop: '0.85rem',
  },
  pagerBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    boxShadow: 'var(--shadow-card)',
    cursor: 'pointer',
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  pagerBtnDisabled: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
    fontSize: '1.15rem',
    fontWeight: 700,
  },
  pagerMeta: { color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 },
};
