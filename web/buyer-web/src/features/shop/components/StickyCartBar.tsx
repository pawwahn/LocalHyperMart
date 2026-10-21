import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { getPublicPlatformSettings } from '@/features/auth/api/platformSettingsApi';
import { MealPlannerSheet } from '@/features/meal-planner/components/MealPlannerSheet';
import mealPlannerIcon from '@/features/meal-planner/meal-planner-icon.png';
import { DeliveryUnlockChip } from './DeliveryUnlockChip';
import { MembershipPlansSheet } from './MembershipPlansSheet';
import { useDeliveryQuote } from '../hooks/useDeliveryQuote';
import { useShop } from '../hooks/useShop';
import { cheapestPurchasable, fetchMembershipCatalog, type MembershipCatalog } from '../api/membershipApi';

type Props = {
  itemCount?: number;
  totalLabel?: string;
  to?: string;
  label?: string;
};

/** Floating bag CTA — compact Blinkit/Zepto bar. Hidden on basket. */
export function StickyCartBar({
  itemCount: itemCountProp,
  totalLabel: totalLabelProp,
  to = '/cart',
  label = 'Next',
}: Props) {
  const { session } = useAuth();
  const { townId, openPicker } = useTown();
  const { cart, busyKey, quantityFor, rememberItems, doIncrease, doDecrease } = useShop();
  const [plansOpen, setPlansOpen] = useState(false);
  const [mealPlannerOn, setMealPlannerOn] = useState(false);
  const [mealPlannerIconUrl, setMealPlannerIconUrl] = useState('');
  const [mealPlannerOpen, setMealPlannerOpen] = useState(false);
  const [membershipCatalog, setMembershipCatalog] = useState<MembershipCatalog | null>(null);
  const itemCount = itemCountProp ?? cart?.itemCount ?? 0;
  const itemsPayable = cart?.payableSubtotal ?? 0;
  const totalLabel = totalLabelProp ?? cart?.payableLabel;
  const { nudge, progress } = useDeliveryQuote(itemsPayable, itemCount > 0);

  const starterPlan = cheapestPurchasable(membershipCatalog);
  const memberCredits = membershipCatalog?.mine?.usableCredits ?? 0;
  const showPlanLink =
    itemCount > 0 &&
    Boolean(membershipCatalog?.platformEnabled) &&
    memberCredits <= 0 &&
    !membershipCatalog?.mine?.active &&
    Boolean(starterPlan);

  useEffect(() => {
    let cancelled = false;
    void getPublicPlatformSettings()
      .then((s) => {
        if (!cancelled) {
          setMealPlannerOn(s.mealPlannerEnabled);
          setMealPlannerIconUrl(s.mealPlannerIconUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMealPlannerOn(false);
          setMealPlannerIconUrl('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) {
      setMembershipCatalog(null);
      return;
    }
    let cancelled = false;
    void fetchMembershipCatalog(token, townId || undefined)
      .then((catalog) => {
        if (!cancelled) setMembershipCatalog(catalog);
      })
      .catch(() => {
        if (!cancelled) setMembershipCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, townId]);

  if (itemCount <= 0) return null;

  return (
    <div style={styles.wrap} role="region" aria-label="Cart summary">
      <style>{BAR_CSS}</style>
      <div className="hlm-cart-bar" style={styles.bar}>
        <Link to={to} style={styles.leftLink}>
          <span style={styles.count}>
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
          {totalLabel ? <span style={styles.total}>{totalLabel}</span> : null}
        </Link>
        <div className="hlm-cart-bar-mid">
          {nudge ? (
            <DeliveryUnlockChip
              layout="compact"
              addMore={nudge.addMore}
              nextFee={nudge.nextFee}
              progress={progress}
            />
          ) : (
            <span style={styles.spacer} />
          )}
          {showPlanLink ? (
            <button
              type="button"
              style={styles.planLink}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPlansOpen(true);
              }}
            >
              <span className="hlm-cart-bar-plan-full">
                Free delivery plan ₹{Number(starterPlan?.price ?? 0).toFixed(0)}
              </span>
              <span className="hlm-cart-bar-plan-short">
                Plan ₹{Number(starterPlan?.price ?? 0).toFixed(0)}
              </span>
            </button>
          ) : null}
        </div>
        {mealPlannerOn ? (
          <button
            type="button"
            style={styles.mealIcon}
            aria-label="Meal planner"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!townId) {
                openPicker();
                return;
              }
              setMealPlannerOpen(true);
            }}
          >
            <img src={mealPlannerIconUrl || mealPlannerIcon} alt="" style={styles.mealIconImg} />
          </button>
        ) : null}
        <Link to={to} style={styles.cta}>
          {label}
          <span aria-hidden>→</span>
        </Link>
      </div>
      <MealPlannerSheet
        open={mealPlannerOpen && mealPlannerOn}
        townId={townId ?? ''}
        busyKey={busyKey}
        quantityFor={quantityFor}
        rememberItems={rememberItems}
        onIncrease={(listingId) => void doIncrease(listingId)}
        onDecrease={(listingId) => void doDecrease(listingId)}
        onClose={() => setMealPlannerOpen(false)}
      />
      <MembershipPlansSheet
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        onBought={() => {
          const token = session?.accessToken;
          if (!token) return;
          void fetchMembershipCatalog(token, townId || undefined).then(setMembershipCatalog).catch(() => undefined);
        }}
      />
    </div>
  );
}

const BAR_CSS = `
  .hlm-cart-bar-mid {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 1 1 auto;
    min-width: 0;
  }
  .hlm-cart-bar-mid .cart-unlock {
    flex: 1 1 auto;
    min-width: 0;
  }
  .hlm-cart-bar-plan-short { display: none; }
  @media (max-width: 540px) {
    .hlm-cart-bar {
      flex-wrap: wrap;
      row-gap: 0.22rem;
    }
    .hlm-cart-bar-mid {
      flex: 1 1 100%;
      order: -1;
      justify-content: space-between;
      gap: 0.45rem;
      padding: 0 0.1rem 0.28rem;
      border-bottom: 1px solid rgba(255,255,255,0.2);
    }
    .hlm-cart-bar-mid .cart-unlock {
      flex: 1 1 auto;
    }
    .hlm-cart-bar-plan-full { display: none; }
    .hlm-cart-bar-plan-short { display: inline; }
  }
`;

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
    zIndex: 40,
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0.75rem 0.35rem',
    pointerEvents: 'none',
    animation: 'hlm-slide-up 220ms ease both',
  },
  bar: {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: 'var(--shell-max)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: '#0C831F',
    color: '#fff',
    borderRadius: 12,
    padding: '0.35rem 0.35rem 0.35rem 0.65rem',
    boxShadow: '0 8px 20px rgba(12, 131, 31, 0.32)',
    minHeight: 48,
  },
  leftLink: {
    display: 'grid',
    gap: 0,
    flex: '0 0 auto',
    minWidth: 0,
    textDecoration: 'none',
    color: 'inherit',
    lineHeight: 1.15,
  },
  count: {
    fontSize: '0.6rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  total: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '0.92rem',
    letterSpacing: '-0.02em',
  },
  spacer: { flex: '1 1 auto', minWidth: 0 },
  mealIcon: {
    flex: '0 0 auto',
    width: 40,
    height: 36,
    padding: 0,
    border: 'none',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'transparent',
    lineHeight: 0,
  },
  mealIconImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  planLink: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    color: '#F7CE46',
    fontWeight: 800,
    fontSize: '0.62rem',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  cta: {
    fontWeight: 800,
    fontSize: '0.78rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    background: '#F7CE46',
    color: '#0a1a08',
    padding: '0.38rem 0.7rem',
    borderRadius: 999,
    flex: '0 0 auto',
    minHeight: 32,
    textDecoration: 'none',
  },
};
