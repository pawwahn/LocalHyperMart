import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { Banner } from '@/shared/ui';
import { getTownConfig, listTowns, type TownVm } from '@/features/towns/api/townsApi';
import { listVendors, type VendorVm } from '@/features/vendors/api/vendorsApi';

function isGroceryVendor(vendor: VendorVm): boolean {
  const name = (vendor.serviceName ?? '').toLowerCase();
  return name.includes('grocer');
}

export function GroceryAdminPage() {
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [towns, setTowns] = useState<TownVm[]>([]);
  const [townId, setTownId] = useState('');
  const [vendors, setVendors] = useState<VendorVm[]>([]);
  const [minOrder, setMinOrder] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void listTowns(token)
      .then((rows) => {
        setTowns(rows);
        setTownId((prev) => prev || rows[0]?.id || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load towns'));
  }, [token]);

  useEffect(() => {
    if (!token || !townId) return;
    let cancelled = false;
    setError(null);
    void listVendors(token, townId)
      .then((rows) => {
        if (cancelled) return;
        setVendors(rows.filter(isGroceryVendor));
      })
      .catch((err) => {
        if (cancelled) return;
        setVendors([]);
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load vendors');
      });
    void getTownConfig(token, townId)
      .then((cfg) => {
        if (cancelled) return;
        setMinOrder(cfg.minOrderValue);
      })
      .catch(() => {
        if (cancelled) return;
        setMinOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId]);

  const townName = towns.find((t) => t.id === townId)?.displayName ?? 'this town';
  const activeShops = useMemo(() => vendors.filter((v) => v.status === 'ACTIVE'), [vendors]);

  return (
    <PortalShell title="Koya Grocery — town setup">
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <section style={styles.hero}>
        <h2 style={styles.heroTitle}>How grocery works</h2>
        <ol style={styles.steps}>
          <li>
            <strong>Vendors</strong> — Register with service <em>Groceries</em> (
            <Link to="/vendors" style={styles.link}>
              Vendors
            </Link>
            ).
          </li>
          <li>
            <strong>Listings</strong> — Shops map master catalog items to prices (
            <Link to="/store-listings" style={styles.link}>
              Listings
            </Link>
            ,{' '}
            <Link to="/catalog" style={styles.link}>
              Catalog
            </Link>
            ).
          </li>
          <li>
            <strong>Town checkout</strong> — Min order, delivery slabs, deals, and grocery scratch cards live under{' '}
            <Link to="/towns" style={styles.link}>
              Towns
            </Link>{' '}
            → town settings (Theme &amp; deals, Delivery fees, Scratch card).
          </li>
        </ol>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>1</span>
          <div>
            <h3 style={styles.cardTitle}>Town</h3>
            <p style={styles.cardSub}>
              Grocery uses the main town checkout. Buyers see shops when the town is enabled and vendors are active.
            </p>
          </div>
        </div>
        <div style={styles.townRow}>
          <label style={styles.townLabel}>
            Town
            <select style={styles.select} value={townId} onChange={(e) => setTownId(e.target.value)}>
              {towns.map((town) => (
                <option key={town.id} value={town.id}>
                  {town.displayName}
                </option>
              ))}
            </select>
          </label>
          <p style={styles.meta}>
            Min order (checkout): {minOrder != null ? `₹${minOrder}` : '…'} · Edit in{' '}
            <Link to="/towns" style={styles.link}>
              Town settings
            </Link>
          </p>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>2</span>
          <div>
            <h3 style={styles.cardTitle}>Grocery shops</h3>
            <p style={styles.cardSub}>Vendors with service Groceries in {townName} (not laundry or glam).</p>
          </div>
        </div>
        {vendors.length === 0 ? (
          <p style={styles.muted}>
            No grocery shops in this town yet.{' '}
            <Link to="/vendors" style={styles.link}>
              Add or edit a vendor
            </Link>{' '}
            and set Service to <strong>Groceries</strong>.
          </p>
        ) : (
          <ul style={styles.shopList}>
            {vendors.map((shop) => (
              <li key={shop.id} style={styles.shopRow}>
                <div>
                  <strong>{shop.businessName}</strong>
                  <span style={styles.shopMeta}>
                    {shop.shopName ?? shop.businessName} · {shop.phone} · {shop.status}
                  </span>
                </div>
                <Link to="/vendors" style={styles.link}>
                  Edit vendor
                </Link>
              </li>
            ))}
          </ul>
        )}
        {activeShops.length > 0 ? (
          <p style={styles.meta}>
            {activeShops.length} active shop{activeShops.length === 1 ? '' : 's'} · Manage product prices in{' '}
            <Link to="/store-listings" style={styles.link}>
              Listings
            </Link>
          </p>
        ) : null}
      </section>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <span style={styles.stepNum}>3</span>
          <div>
            <h3 style={styles.cardTitle}>Orders</h3>
            <p style={styles.cardSub}>Grocery basket orders for {townName}.</p>
          </div>
        </div>
        <p style={styles.muted}>
          <Link to="/orders" style={styles.link}>
            Open Orders
          </Link>{' '}
          and filter by town to track delivery status and claims.
        </p>
      </section>
    </PortalShell>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    marginBottom: '0.75rem',
    padding: '0.65rem 0.75rem',
    borderRadius: 10,
    background: 'var(--accent-soft, rgba(12, 131, 31, 0.08))',
    border: '1px solid var(--border)',
  },
  heroTitle: { margin: '0 0 0.35rem', fontSize: '0.92rem' },
  steps: { margin: 0, paddingLeft: '1.15rem', fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--text-muted)' },
  link: { color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' },
  card: {
    marginBottom: '0.65rem',
    padding: '0.65rem 0.75rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  cardHead: { display: 'flex', gap: '0.55rem', alignItems: 'flex-start', marginBottom: '0.5rem' },
  stepNum: {
    flex: '0 0 auto',
    width: 22,
    height: 22,
    borderRadius: 999,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
  },
  cardTitle: { margin: 0, fontSize: '0.88rem' },
  cardSub: { margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 },
  townRow: { display: 'grid', gap: '0.45rem' },
  townLabel: { display: 'grid', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 700, maxWidth: 320 },
  select: {
    padding: '0.35rem 0.45rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    font: 'inherit',
  },
  meta: { margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' },
  muted: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  shopList: { margin: '0 0 0.45rem', padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' },
  shopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.45rem 0.5rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    fontSize: '0.82rem',
  },
  shopMeta: { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 },
};
