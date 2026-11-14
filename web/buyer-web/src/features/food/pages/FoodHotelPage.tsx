import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PortalShell } from '@/shared/layout/PortalShell';
import { useTown } from '@/shared/town/TownContext';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/http';
import { useShop } from '@/features/shop/hooks/useShop';
import { fetchFoodHotel, fetchFoodMenu, type BuyerFoodMenu, type FoodHotelCard, type FoodMenuItem } from '../api/foodApi';
import { FoodHotelGallery } from '../components/FoodHotelGallery';
import { FoodMenuView } from '../components/FoodMenuView';

function menuSections(menu: BuyerFoodMenu | null) {
  if (!menu) return [];
  return menu.categories
    .filter((c) => c.active && c.name.trim().length > 0)
    .map((c) => ({ ...c, items: c.items.filter((i) => i.active) }))
    .filter((c) => c.items.length > 0);
}

export function FoodHotelPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { townId, townLabel } = useTown();
  const { session } = useAuth();
  const token = session?.accessToken ?? '';
  const navigate = useNavigate();
  const { doIncrease, doDecrease, quantityFor, busyKey } = useShop();
  const [menu, setMenu] = useState<BuyerFoodMenu | null>(null);
  const [hotel, setHotel] = useState<FoodHotelCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const menuPromise = fetchFoodMenu(vendorId, townId, token || null);
    const hotelPromise = token ? fetchFoodHotel(token, vendorId).catch(() => null) : Promise.resolve(null);
    void Promise.all([menuPromise, hotelPromise])
      .then(([data, hotelCard]) => {
        if (!cancelled) {
          setMenu(data);
          setHotel(hotelCard);
          const sections = menuSections(data);
          const first = sections[0]?.id ?? null;
          setActiveCat(first);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load menu');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId, townId, token]);

  const sections = useMemo(() => menuSections(menu), [menu]);

  const activeItems = useMemo(() => {
    const cat = sections.find((c) => c.id === activeCat) ?? sections[0];
    return cat?.items ?? [];
  }, [sections, activeCat]);

  const shopTitle = menu?.shopName ?? hotel?.shopName ?? 'Menu';
  const heroPhotos = hotel?.hotelPhotos ?? [];
  const showHero = heroPhotos.length > 0 || Boolean(hotel?.cuisines || hotel?.tagline || hotel?.offerLabel || hotel?.pureVeg);

  function ensureListing(item: FoodMenuItem): string | null {
    if (!token) {
      navigate('/login');
      return null;
    }
    if (!item.listingId) {
      setToast('This dish is not published yet');
      return null;
    }
    return item.listingId;
  }

  function increaseItem(item: FoodMenuItem) {
    const listingId = ensureListing(item);
    if (!listingId) return;
    void doIncrease(listingId, { listingKind: 'FOOD_MENU' });
  }

  function decreaseItem(item: FoodMenuItem) {
    const listingId = ensureListing(item);
    if (!listingId) return;
    void doDecrease(listingId);
  }

  return (
    <PortalShell
      title={shopTitle}
      subtitle={townLabel}
      hideTitle
      showDeliveryBanner={false}
      showStickyCart
    >
      <motionHeader
        title={shopTitle}
        townLabel={townLabel}
        rating={hotel?.ratingScore}
        ratingCount={hotel?.ratingCount}
        accepting={hotel?.acceptingOrders}
      />

      {error ? <p style={styles.error}>{error}</p> : null}

      {!loading && showHero ? (
        <FoodHotelGallery
          variant="hero"
          title={shopTitle}
          subtitle={hotel?.cuisines || hotel?.tagline}
          photos={heroPhotos}
          pureVeg={hotel?.pureVeg}
          offerLabel={hotel?.offerLabel}
          hideTitleInHero
        />
      ) : null}

      <FoodMenuView
        sections={sections}
        activeItems={activeItems}
        activeCatId={activeCat}
        onActiveCatChange={setActiveCat}
        quantityFor={quantityFor}
        busyListingId={busyKey}
        onIncrease={increaseItem}
        onDecrease={decreaseItem}
        loading={loading}
        backHref="/food"
        backLabel={townLabel ? `Restaurants in ${townLabel}` : 'All restaurants'}
      />

      {toast ? (
        <div style={styles.toast} role="status">
          {toast}
          <button type="button" style={styles.toastClose} onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      ) : null}
    </PortalShell>
  );
}

function motionHeader({
  title,
  townLabel,
  rating,
  ratingCount,
  accepting,
}: {
  title: string;
  townLabel: string;
  rating?: number;
  ratingCount?: number;
  accepting?: boolean;
}) {
  return (
    <div style={styles.headRow}>
      <div style={styles.headCopy}>
        <h1 style={styles.pageTitle}>{title}</h1>
        <p style={styles.pageMeta}>
          {townLabel}
          {typeof rating === 'number' && rating > 0 ? (
            <span style={styles.rating}>
              ★ {rating.toFixed(1)}
              {ratingCount ? ` (${ratingCount})` : ''}
            </span>
          ) : null}
          {accepting === false ? <span style={styles.closed}> · Not taking orders</span> : null}
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  headRow: { marginBottom: '0.35rem' },
  headCopy: { minWidth: 0 },
  pageTitle: {
    margin: 0,
    fontSize: '1.15rem',
    fontWeight: 900,
    fontFamily: 'var(--font-display)',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  pageMeta: {
    margin: '0.2rem 0 0',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    alignItems: 'center',
  },
  rating: { fontWeight: 800, color: 'var(--text)' },
  closed: { color: 'var(--danger)', fontWeight: 700 },
  error: { color: 'var(--danger)', fontSize: '0.88rem' },
  toast: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)',
    background: '#1f2937',
    color: '#fff',
    padding: '0.5rem 0.85rem',
    borderRadius: 10,
    fontSize: '0.85rem',
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    zIndex: 50,
    maxWidth: 'min(92vw, 360px)',
  },
  toastClose: { border: 'none', background: 'transparent', color: '#fff', fontSize: '1.1rem', cursor: 'pointer' },
};