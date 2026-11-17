import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import { useTown } from '@/shared/town/TownContext';
import { buildShopServiceBanners } from '@/features/shop/config/shopServiceBanners';
import {
  ServiceDiagnosticsIcon,
  ServiceGlamIcon,
  ServiceGroceryIcon,
  ServiceLaundryIcon,
} from '@/features/shop/components/JumpCardIcons';
import type { ShopServiceBanner } from '@/features/shop/config/shopServiceBanners';
import { Button } from '@/shared/ui';

const LAUNCH_CSS = `
  .hlm-town-launch-backdrop {
    animation: hlm-town-launch-fade 320ms ease both;
  }

  @keyframes hlm-town-launch-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .hlm-town-launch-panel {
    animation: hlm-town-launch-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes hlm-town-launch-rise {
    from {
      opacity: 0;
      transform: translateY(28px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .hlm-town-launch-hero-dot {
    position: absolute;
    border-radius: 999px;
    pointer-events: none;
    animation: hlm-town-launch-float 5s ease-in-out infinite;
  }

  @keyframes hlm-town-launch-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  .hlm-town-launch-track {
    display: flex;
    gap: 0.55rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--shell-pad);
    padding: 0.15rem var(--shell-pad) 0.35rem;
    margin-inline: calc(-1 * var(--shell-pad));
    -webkit-overflow-scrolling: touch;
  }

  .hlm-town-launch-track::-webkit-scrollbar {
    display: none;
  }

  .hlm-town-launch-track--solo {
    justify-content: center;
    overflow: visible;
    scroll-snap-type: none;
  }

  .hlm-town-launch-card {
    --launch-accent: var(--accent);
    position: relative;
    flex: 0 0 min(72vw, 250px);
    min-width: 200px;
    scroll-snap-align: center;
    border: none;
    border-radius: 18px;
    padding: 0.7rem 0.65rem 0.62rem;
    min-height: 8.75rem;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    color: var(--text);
    background:
      linear-gradient(155deg, #fff 0%, color-mix(in srgb, var(--launch-accent) 6%, #fff) 45%, color-mix(in srgb, var(--launch-accent) 22%, #fff) 100%);
  }

  .hlm-town-launch-track--solo .hlm-town-launch-card {
    flex: 0 1 min(100%, 280px);
    min-width: 0;
  }

  .hlm-town-launch-card {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.75) inset,
      0 10px 28px color-mix(in srgb, var(--launch-accent) 16%, rgba(15, 23, 42, 0.12));
    transition: transform 160ms ease, box-shadow 160ms ease;
    animation: hlm-town-launch-card-in 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--launch-i, 0) * 55ms + 80ms);
    -webkit-tap-highlight-color: transparent;
  }

  @keyframes hlm-town-launch-card-in {
    from {
      opacity: 0;
      transform: translateY(14px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .hlm-town-launch-card:active {
    transform: scale(0.98);
  }

  .hlm-town-launch-card-glow {
    position: absolute;
    top: -35%;
    right: -25%;
    width: 70%;
    aspect-ratio: 1;
    border-radius: 999px;
    background: radial-gradient(
      circle at 42% 42%,
      color-mix(in srgb, var(--launch-accent) 42%, transparent),
      transparent 68%
    );
    pointer-events: none;
    opacity: 0.65;
  }

  .hlm-town-launch-card-icon {
    position: absolute;
    right: 0.45rem;
    bottom: 0.45rem;
    width: 50px;
    height: 50px;
    display: grid;
    place-items: center;
    border-radius: 15px;
    background: color-mix(in srgb, #fff 76%, transparent);
    box-shadow: 0 5px 16px color-mix(in srgb, var(--launch-accent) 14%, rgba(0, 0, 0, 0.1));
    transform: rotate(-8deg);
    color: var(--launch-accent);
  }

  .hlm-town-launch-card-icon svg {
    width: 28px !important;
    height: 28px !important;
  }

  .hlm-town-launch-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.32rem;
    margin-top: 0.15rem;
  }

  .hlm-town-launch-chip {
    font-size: 0.62rem;
    font-weight: 750;
    line-height: 1.2;
    padding: 0.28rem 0.48rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-muted) 55%, transparent);
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    color: var(--text-muted);
  }
`;

function ServiceIcon({ id, accent, large }: { id: ShopServiceBanner['id']; accent: string; large?: boolean }) {
  const wrap: CSSProperties = large
    ? {}
    : {
        width: 40,
        height: 40,
        borderRadius: 11,
        display: 'grid',
        placeItems: 'center',
        background: `color-mix(in srgb, ${accent} 11%, var(--bg-muted))`,
        color: accent,
        flexShrink: 0,
      };
  const icon =
    id === 'grocery' || id === 'food' ? (
      <ServiceGroceryIcon />
    ) : id === 'glam' ? (
      <ServiceGlamIcon />
    ) : id === 'diagnostics' ? (
      <ServiceDiagnosticsIcon />
    ) : (
      <ServiceLaundryIcon />
    );
  return large ? icon : <span style={wrap} aria-hidden>{icon}</span>;
}

function serviceTag(id: ShopServiceBanner['id']): string {
  if (id === 'grocery') return 'Grocery';
  if (id === 'glam') return 'Glam';
  if (id === 'laundry') return 'Laundry';
  if (id === 'diagnostics') return 'Health';
  return 'Food';
}

function shortTownHeadline(townLabel: string): { primary: string; secondary: string } {
  if (townLabel === 'Choose your town') return { primary: 'Your town', secondary: '' };
  const parts = townLabel.split(',').map((p) => p.trim());
  if (parts.length >= 2) return { primary: parts[0], secondary: parts.slice(1).join(', ') };
  return { primary: townLabel, secondary: '' };
}

/**
 * Explains which services are on in the current town and how to open them.
 * Shown after town pick, town switch, and when the buyer signs in with a town already set.
 */
const SERVICE_BOOKING_PREFIXES = ['/beauty', '/laundry', '/diagnostics', '/food'] as const;

export function TownServicesIntroHost() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onServiceBookingPage = SERVICE_BOOKING_PREFIXES.some((p) => location.pathname.startsWith(p));
  const {
    townId,
    townLabel,
    hasTown,
    pickerOpen,
    themeColor,
    laundryEnabled,
    laundryReady,
    beautyEnabled,
    beautyReady,
    diagnosticsEnabled,
    diagnosticsReady,
    foodDeliveryEnabled,
    foodDeliveryReady,
    groceryEnabled,
    groceryReady,
  } = useTown();

  const townServicesReady =
    laundryReady && beautyReady && diagnosticsReady && foodDeliveryReady && groceryReady;

  const services = useMemo(
    () =>
      buildShopServiceBanners({
        groceryEnabled,
        beautyEnabled,
        laundryEnabled,
        diagnosticsEnabled,
        foodDeliveryEnabled,
      }),
    [groceryEnabled, beautyEnabled, laundryEnabled, diagnosticsEnabled, foodDeliveryEnabled],
  );

  const [open, setOpen] = useState(false);
  const armedTownRef = useRef<string | null>(null);
  const hadSessionRef = useRef(Boolean(session));
  /** Bumps when the buyer signs in so we re-run the open effect even if town + flags are unchanged. */
  const [introArmKey, setIntroArmKey] = useState(0);

  useEffect(() => {
    if (!townId) {
      armedTownRef.current = null;
      setOpen(false);
      return;
    }
    armedTownRef.current = townId;
  }, [townId]);

  useEffect(() => {
    const authed = Boolean(session);
    if (authed && !hadSessionRef.current && townId) {
      armedTownRef.current = townId;
      setIntroArmKey((k) => k + 1);
    }
    hadSessionRef.current = authed;
  }, [session, townId]);

  useEffect(() => {
    if (!hasTown || !townId || pickerOpen || onServiceBookingPage) return;
    if (armedTownRef.current !== townId) return;
    if (!townServicesReady) return;
    if (services.length === 0) {
      armedTownRef.current = null;
      return;
    }
    setOpen(true);
    armedTownRef.current = null;
  }, [hasTown, townId, pickerOpen, onServiceBookingPage, townServicesReady, services.length, introArmKey]);

  useEffect(() => {
    if (onServiceBookingPage && open) setOpen(false);
  }, [onServiceBookingPage, open]);

  useEffect(() => {
    if (open) {
      document.body.classList.add('hlm-scroll-lock');
    } else {
      document.body.classList.remove('hlm-scroll-lock');
    }
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    return () => document.body.classList.remove('hlm-scroll-lock');
  }, []);

  if (!open) return null;

  const multi = services.length > 1;
  const townHead = shortTownHeadline(townLabel);
  const heroAccent = themeColor?.trim() || '#0C831F';

  function goTo(banner: ShopServiceBanner) {
    setOpen(false);
    navigate(banner.to);
  }

  return (
    <div
      className="hlm-town-launch-backdrop"
      style={styles.backdrop}
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <style>{LAUNCH_CSS}</style>
      <div
        className="hlm-town-launch-panel"
        style={styles.panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="town-services-intro-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            ...styles.hero,
            background: `linear-gradient(145deg, color-mix(in srgb, ${heroAccent} 88%, #052e10) 0%, ${heroAccent} 42%, color-mix(in srgb, ${heroAccent} 70%, #f7ce46) 115%)`,
          }}
        >
          <span
            className="hlm-town-launch-hero-dot"
            style={{ width: 120, height: 120, top: -24, right: -20, background: 'rgba(247,206,70,0.35)' }}
            aria-hidden
          />
          <span
            className="hlm-town-launch-hero-dot"
            style={{
              width: 72,
              height: 72,
              bottom: 12,
              left: -18,
              background: 'rgba(255,255,255,0.12)',
              animationDelay: '-1.5s',
            }}
            aria-hidden
          />
          <div style={styles.heroTop}>
            <span style={styles.liveBadge}>
              <span style={styles.liveDot} aria-hidden />
              {services.length} live now
            </span>
            <button
              type="button"
              style={styles.closeBtn}
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <p style={styles.heroKicker}>Your local launchpad</p>
          <h2 id="town-services-intro-title" style={styles.heroTitle}>
            {townHead.primary}
            {townHead.secondary ? (
              <span style={styles.heroTitleSub}> {townHead.secondary}</span>
            ) : null}
          </h2>
          <p style={styles.heroSub}>
            {multi
              ? 'Swipe a card to jump in — or open Services anytime from the bottom bar.'
              : 'One service is ready for you. Tap the card to start.'}
          </p>
        </header>

        <div style={styles.body}>
          <div
            className={`hlm-town-launch-track hlm-hide-scrollbar ${multi ? '' : 'hlm-town-launch-track--solo'}`}
            aria-label="Services in your town"
          >
            {services.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                className="hlm-town-launch-card"
                style={
                  {
                    ['--launch-accent' as string]: banner.accent,
                    ['--launch-i' as string]: index,
                    border: `1px solid color-mix(in srgb, ${banner.accent} 22%, var(--border))`,
                  } as CSSProperties
                }
                aria-label={banner.ariaLabel}
                onClick={() => goTo(banner)}
              >
                <span className="hlm-town-launch-card-glow" aria-hidden />
                <span
                  style={{
                    ...styles.cardTag,
                    color: banner.accent,
                    background: `color-mix(in srgb, ${banner.accent} 10%, #fff)`,
                  }}
                >
                  {serviceTag(banner.id)}
                </span>
                <strong style={styles.cardTitle}>{banner.title}</strong>
                <span style={styles.cardHint}>{banner.hint}</span>
                <span style={{ ...styles.cardCta, color: banner.accent }}>
                  {banner.cta}
                  <span aria-hidden> →</span>
                </span>
                <span className="hlm-town-launch-card-icon" aria-hidden>
                  <ServiceIcon id={banner.id} accent={banner.accent} large />
                </span>
              </button>
            ))}
          </div>

          <div className="hlm-town-launch-chip-row" aria-label="Quick tips">
            {multi ? <span className="hlm-town-launch-chip">Services tab — all in one place</span> : null}
            <span className="hlm-town-launch-chip">Home — coloured jump cards</span>
            <span className="hlm-town-launch-chip">Town name — switch anytime</span>
          </div>

          <Button type="button" fullWidth onClick={() => setOpen(false)} style={styles.ctaBtn}>
            Got it — explore home
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 92,
    background: 'rgba(8, 18, 14, 0.62)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '0.35rem 0.4rem calc(0.4rem + env(safe-area-inset-bottom, 0px))',
    boxSizing: 'border-box',
  },
  panel: {
    width: '100%',
    maxWidth: 'var(--shell-max)',
    margin: '0 auto',
    borderRadius: 22,
    overflow: 'hidden',
    border: '1px solid color-mix(in srgb, #fff 16%, transparent)',
    boxShadow: '0 24px 64px rgba(5, 20, 12, 0.38), 0 0 0 1px rgba(255,255,255,0.06) inset',
    maxHeight: 'min(88dvh, 640px)',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    boxSizing: 'border-box',
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    padding: '0.85rem var(--shell-pad) 0.95rem',
    color: '#fff',
  },
  heroTop: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.35rem',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '0.28rem 0.55rem',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.22)',
    backdropFilter: 'blur(8px)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: '#86efac',
    boxShadow: '0 0 0 3px rgba(134, 239, 172, 0.35)',
  },
  closeBtn: {
    border: 'none',
    background: 'rgba(255,255,255,0.16)',
    color: '#fff',
    width: 34,
    height: 34,
    borderRadius: 11,
    fontSize: '1.35rem',
    lineHeight: 1,
    cursor: 'pointer',
    flexShrink: 0,
  },
  heroKicker: {
    position: 'relative',
    zIndex: 1,
    margin: 0,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#F7CE46',
  },
  heroTitle: {
    position: 'relative',
    zIndex: 1,
    margin: '0.22rem 0 0',
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.45rem, 6vw, 1.85rem)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1.08,
  },
  heroTitleSub: {
    fontWeight: 700,
    opacity: 0.88,
    fontSize: '0.92em',
  },
  heroSub: {
    position: 'relative',
    zIndex: 1,
    margin: '0.42rem 0 0',
    fontSize: '0.78rem',
    fontWeight: 500,
    lineHeight: 1.4,
    opacity: 0.92,
    maxWidth: '28rem',
  },
  body: {
    background: 'var(--bg-elevated)',
    padding: '0.65rem var(--shell-pad) 0.75rem',
    display: 'grid',
    gap: '0.55rem',
    overflowY: 'auto',
    minHeight: 0,
  },
  cardTag: {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    fontSize: '0.58rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.2rem 0.45rem',
    borderRadius: 999,
    lineHeight: 1,
  },
  cardTitle: {
    position: 'relative',
    zIndex: 1,
    display: 'block',
    marginTop: '0.4rem',
    fontFamily: 'var(--font-display)',
    fontSize: '0.95rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    paddingRight: '3.5rem',
  },
  cardHint: {
    position: 'relative',
    zIndex: 1,
    display: 'block',
    marginTop: '0.28rem',
    fontSize: '0.68rem',
    fontWeight: 500,
    lineHeight: 1.35,
    color: 'var(--text-muted)',
    paddingRight: '2.8rem',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  } as CSSProperties,
  cardCta: {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: '0.45rem',
    padding: '0.3rem 0.55rem',
    borderRadius: 999,
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    background: 'color-mix(in srgb, #fff 84%, transparent)',
    boxShadow: '0 2px 8px rgba(16, 24, 40, 0.08)',
  },
  ctaBtn: {
    minHeight: 46,
  },
};