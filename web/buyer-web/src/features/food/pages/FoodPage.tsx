import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useTown } from '@/shared/town/TownContext';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { fetchFoodHotels, type FoodHotelCard } from '../api/foodApi';
import { FoodHotelGallery } from '../components/FoodHotelGallery';

export function FoodPage() {
  const { foodDeliveryEnabled, foodDeliveryReady, townId, townLabel, hasTown } = useTown();
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const [hotels, setHotels] = useState<FoodHotelCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !hasTown || !foodDeliveryEnabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchFoodHotels(token, townId)
      .then((rows) => {
        if (!cancelled) setHotels(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load hotels');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, townId, hasTown, foodDeliveryEnabled]);

  if (foodDeliveryReady && !foodDeliveryEnabled) {
    return (
      <PortalShell title="Food" subtitle={townLabel} showStickyCart={false}>
        <p>Food delivery is not available in {townLabel || 'this town'} yet.</p>
        <Link to="/shop">Back to services</Link>
      </PortalShell>
    );
  }

  return (
    <PortalShell title="Food" subtitle={townLabel || 'Hotels near you'} showStickyCart>
      {!token ? (
        <p style={styles.muted}>
          <Link to="/login">Sign in</Link> to order from local hotels.
        </p>
      ) : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {loading ? <p style={styles.muted}>Loading hotels…</p> : null}
      {!loading && token && hotels.length === 0 ? (
        <p style={styles.muted}>No hotels are live in {townLabel} yet.</p>
      ) : null}
      <div style={styles.grid}>
        {hotels.map((h) => (
          <Link key={h.vendorId} to={`/food/${h.vendorId}`} style={styles.cardLink}>
            <FoodHotelGallery
              variant="card"
              title={h.shopName || h.businessName}
              subtitle={h.cuisines || h.tagline}
              photos={h.hotelPhotos ?? []}
              pureVeg={h.pureVeg}
              offerLabel={h.offerLabel}
            />
            <HotelMeta card={h} />
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}

function HotelMeta({ card }: { card: FoodHotelCard }) {
  return (
    <div style={styles.metaBlock}>
      <MetaRow>
        {card.ratingCount > 0 ? (
          <span style={styles.rating}>
            {card.ratingScore.toFixed(1)}★ ({card.ratingCount})
          </span>
        ) : null}
        {card.priceForOne != null ? <span>₹{card.priceForOne} for one</span> : null}
        {card.opensAtLabel ? <span>{card.opensAtLabel}</span> : null}
      </MetaRow>
    </div>
  );
}

function MetaRow({ children }: { children: ReactNode }) {
  return <div style={styles.metaRow}>{children}</div>;
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
    gap: '0.75rem',
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  metaBlock: { padding: '0 0.15rem' },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem 0.6rem',
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
  },
  rating: { fontWeight: 700, color: 'var(--text)' },
  muted: { color: 'var(--text-muted)', fontSize: '0.9rem' },
  error: { color: '#b91c1c', fontSize: '0.9rem' },
};