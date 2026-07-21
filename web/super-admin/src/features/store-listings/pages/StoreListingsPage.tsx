import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import { listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listVendors, type VendorVm } from '@/features/vendors/api/vendorsApi';
import { listStoreListings, type AdminListingVm } from '../api/storeListingsApi';

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

  const summary = useMemo(() => {
    const live = items.filter((i) => i.active).length;
    const hidden = items.length - live;
    const shops = new Set(items.map((i) => i.shopName)).size;
    const categories = new Set(items.map((i) => i.category)).size;
    return { total: items.length, live, hidden, shops, categories };
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
          active:
            activeFilter === 'live' ? true : activeFilter === 'hidden' ? false : '',
        }),
      ]);
      setVendors(vendorList);
      setItems(listings);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [token, townId, vendorId, shopName, activeFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
    a.download = `store-listings-${shopPart}-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const reportTitle = selectedVendor
    ? `${selectedVendor.shopName || selectedVendor.businessName} listings`
    : shopName.trim()
      ? `Listings matching “${shopName.trim()}”`
      : townId
        ? `All store listings in ${townNameById.get(townId) ?? 'town'}`
        : 'All store listings';

  return (
    <PortalShell title="Store listings report" onRefresh={() => void reload()}>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card>
        <h2 style={styles.sectionTitle}>Vendor listing report</h2>
        <p style={styles.intro}>
          Choose a town and store to see every product that vendor has listed for buyers in that town.
        </p>
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
          <TextField
            label="Or shop name contains"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Ravi Kirana"
          />
          <label style={styles.label}>
            Status
            <select
              style={styles.select}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as 'all' | 'live' | 'hidden')}
            >
              <option value="all">All</option>
              <option value="live">Live in town</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
        </div>
      </Card>

      <div style={styles.stats}>
        <Stat label="Products" value={String(summary.total)} />
        <Stat label="Live" value={String(summary.live)} />
        <Stat label="Hidden" value={String(summary.hidden)} />
        <Stat label="Stores" value={String(summary.shops)} />
        <Stat label="Categories" value={String(summary.categories)} />
      </div>

      <Card>
        <div style={styles.reportHead}>
          <div>
            <h2 style={styles.sectionTitle}>{reportTitle}</h2>
            <p style={styles.meta}>
              {selectedVendor
                ? `Vendor ID ${selectedVendor.id}`
                : 'Tip: pick Town → Vendor for a clean per-store report.'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || items.length === 0}
            onClick={exportCsv}
          >
            Download CSV
          </Button>
        </div>

        {loading ? (
          <p style={styles.muted}>Loading report…</p>
        ) : items.length === 0 ? (
          <p style={styles.muted}>No store listings match these filters.</p>
        ) : (
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
                    <td style={styles.tdRight}>
                      ₹{Number(item.effectivePrice ?? item.price).toFixed(2)}
                    </td>
                    <td style={styles.tdRight}>
                      {item.mrp != null ? `₹${Number(item.mrp).toFixed(2)}` : '—'}
                    </td>
                    <td style={styles.td}>
                      <span style={item.active ? styles.on : styles.off}>
                        {item.active ? 'LIVE' : 'HIDDEN'}
                      </span>
                    </td>
                    <td style={styles.tdMuted}>{item.vendorNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PortalShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card elevated style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  sectionTitle: { margin: '0 0 0.35rem', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800 },
  intro: { margin: '0 0 0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
  },
  label: { display: 'grid', gap: '0.35rem', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 },
  select: {
    padding: '0.75rem 0.95rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '0.65rem',
  },
  statCard: { display: 'grid', gap: '0.15rem', padding: '0.85rem 1rem' },
  statLabel: { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 },
  statValue: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.55rem',
    fontWeight: 800,
  },
  reportHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  },
  meta: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' },
  muted: { margin: 0, color: 'var(--text-muted)' },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    maxHeight: 'min(65vh, 720px)',
    overflowY: 'auto',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' },
  th: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.5rem 0.55rem',
    textAlign: 'left',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  },
  thRight: {
    position: 'sticky',
    top: 0,
    background: 'var(--bg-muted)',
    padding: '0.5rem 0.55rem',
    textAlign: 'right',
    fontWeight: 700,
    color: 'var(--text-muted)',
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.45rem 0.55rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdMuted: {
    padding: '0.45rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    verticalAlign: 'middle',
  },
  tdRight: {
    padding: '0.45rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    fontWeight: 600,
    verticalAlign: 'middle',
  },
  on: {
    fontSize: '0.65rem',
    color: '#047857',
    background: 'var(--success-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
  off: {
    fontSize: '0.65rem',
    color: '#92400e',
    background: 'var(--warning-soft)',
    borderRadius: 'var(--radius-full)',
    padding: '0.1rem 0.4rem',
    fontWeight: 700,
  },
};
