import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listVendors, type VendorVm } from '@/features/vendors/api/vendorsApi';
import { listStoreListings, type AdminListingVm } from '../api/storeListingsApi';

const PAGE_SIZE = 40;

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function StoreListingsPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [items, setItems] = useState<AdminListingVm[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [townId, setTownId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [shopName, setShopName] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'hidden'>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const townNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const town of towns) map.set(town.id, town.displayName);
    return map;
  }, [towns]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? null,
    [vendors, vendorId],
  );

  const pageStats = useMemo(() => {
    const live = items.filter((i) => i.active).length;
    return {
      live,
      hidden: items.length - live,
      shops: new Set(items.map((i) => i.shopName)).size,
      categories: new Set(items.map((i) => i.category)).size,
    };
  }, [items]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const townList = await listTowns(token);
      setTowns(townList);

      const [vendorList, listings] = await Promise.all([
        townId ? listVendors(token, townId) : Promise.resolve([] as VendorVm[]),
        listStoreListings(token, {
          townId: townId || undefined,
          vendorId: vendorId || undefined,
          shopName: shopName || undefined,
          active: activeFilter === 'live' ? true : activeFilter === 'hidden' ? false : '',
          page,
          size: PAGE_SIZE,
        }),
      ]);
      setVendors(vendorList);
      setItems(listings.items);
      setTotal(listings.total);
      setTotalPages(Math.max(1, listings.totalPages));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [token, townId, vendorId, shopName, activeFilter, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setPage(0);
  }, [townId, vendorId, shopName, activeFilter]);

  function exportCsv() {
    const headers = [
      'Town',
      'Shop',
      'VendorId',
      'Product',
      'Category',
      'Unit',
      'MRP',
      'SellingPrice',
      'DiscountPrice',
      'EffectivePrice',
      'Status',
      'Note',
    ];
    const rows = items.map((item) =>
      [
        townNameById.get(item.townId) ?? item.townId,
        item.shopName,
        item.vendorId,
        item.itemName,
        item.category,
        item.unit,
        item.mrp ?? '',
        item.price,
        item.discountPrice ?? '',
        item.effectivePrice ?? item.price,
        item.active ? 'LIVE' : 'HIDDEN',
        item.vendorNote ?? '',
      ]
        .map(csvEscape)
        .join(','),
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const shopPart = selectedVendor
      ? (selectedVendor.shopName || selectedVendor.businessName || 'vendor').replace(/\s+/g, '-')
      : shopName.trim() || 'all-stores';
    a.href = url;
    a.download = `store-listings-${shopPart}-p${page + 1}-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <PortalShell title="Store listings report" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card style={styles.card}>
        <div style={styles.filters}>
          <label style={styles.label}>
            Town
            <select
              style={styles.select}
              value={townId}
              onChange={(e) => {
                setTownId(e.target.value);
                setVendorId('');
              }}
            >
              <option value="">All towns</option>
              {towns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Vendor / store
            <select
              style={styles.select}
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              disabled={!townId}
            >
              <option value="">{townId ? 'All stores in town' : 'Select a town first'}</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.shopName || v.businessName}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Shop contains
            <input
              style={styles.select}
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Ravi Kirana"
            />
          </label>
          <label style={styles.label}>
            Status
            <select
              style={styles.select}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as 'all' | 'live' | 'hidden')}
            >
              <option value="all">All</option>
              <option value="live">Live</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
          <div style={styles.filterActions}>
            <Button variant="secondary" size="sm" disabled={loading || items.length === 0} onClick={exportCsv}>
              CSV
            </Button>
          </div>
        </div>

        <p style={styles.kpi}>
          <strong>{total.toLocaleString()}</strong> listings
          <span style={styles.dot}>·</span>
          showing {from}–{to}
          <span style={styles.dot}>·</span>
          this page {pageStats.live} live / {pageStats.hidden} hidden
          <span style={styles.dot}>·</span>
          {pageStats.shops} shops
          <span style={styles.dot}>·</span>
          {pageStats.categories} cats
        </p>

        {loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={styles.muted}>No listings match these filters.</p>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Shop</th>
                    <th style={styles.th}>Town</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.thRight}>Sell</th>
                    <th style={styles.thRight}>MRP</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.listingId}>
                      <td style={styles.td}>
                        <strong>{item.itemName}</strong>
                      </td>
                      <td style={styles.td}>{item.shopName}</td>
                      <td style={styles.tdMuted}>{townNameById.get(item.townId) ?? item.townId}</td>
                      <td style={styles.tdMuted}>{item.category}</td>
                      <td style={styles.tdMuted}>{item.unit}</td>
                      <td style={styles.tdRight}>₹{Number(item.effectivePrice ?? item.price).toFixed(2)}</td>
                      <td style={styles.tdRight}>{item.mrp != null ? `₹${Number(item.mrp).toFixed(2)}` : '—'}</td>
                      <td style={styles.td}>
                        <span style={item.active ? styles.on : styles.off}>{item.active ? 'LIVE' : 'HIDDEN'}</span>
                      </td>
                      <td style={styles.tdMuted}>{item.vendorNote || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div style={styles.pager}>
                <Button size="sm" variant="ghost" disabled={page <= 0 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span style={styles.pageMeta}>
                  {from}–{to} of {total.toLocaleString()} · page {page + 1}/{totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page + 1 >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { display: 'grid', gap: '0.5rem' },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.4rem',
    alignItems: 'end',
  },
  label: {
    display: 'grid',
    gap: '0.2rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: 700,
    minWidth: 0,
  },
  select: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '0.42rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.82rem',
  },
  filterActions: { display: 'flex', alignItems: 'end', justifyContent: 'flex-end' },
  kpi: {
    margin: 0,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  dot: { margin: '0 0.35rem', opacity: 0.7 },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(68vh, 640px)',
    overflowY: 'auto',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.78rem' },
  th: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.32rem 0.4rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
  },
  thRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.32rem 0.4rem',
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
    fontSize: '0.66rem',
    textTransform: 'uppercase',
  },
  td: { padding: '0.32rem 0.4rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdMuted: {
    padding: '0.32rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
  },
  tdRight: {
    padding: '0.32rem 0.4rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 600,
    verticalAlign: 'middle',
  },
  on: {
    fontSize: '0.62rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.08rem 0.35rem',
    fontWeight: 700,
  },
  off: {
    fontSize: '0.62rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.08rem 0.35rem',
    fontWeight: 700,
  },
  pager: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageMeta: { margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 },
};
