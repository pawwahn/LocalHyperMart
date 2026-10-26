import { useEffect, useState } from 'react';

type Props = {
  dealsEnabled?: boolean;
  showPlans?: boolean;
  onOpenDeals?: () => void;
  onOpenPlans?: () => void;
};

const OFFERS_CSS = `
  @keyframes hlm-offers-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.35); opacity: 0.65; }
  }

  @keyframes hlm-offers-shimmer {
    0% { transform: translateX(-130%) skewX(-14deg); opacity: 0; }
    40% { opacity: 0.5; }
    100% { transform: translateX(160%) skewX(-14deg); opacity: 0; }
  }

  @keyframes hlm-offers-float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-6px) rotate(6deg); }
  }

  @keyframes hlm-offers-line-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .hlm-offers-wow {
    position: relative;
    width: 100%;
    min-width: 0;
    border-radius: 24px;
    overflow: hidden;
    isolation: isolate;
    box-shadow:
      0 10px 28px rgba(140, 170, 70, 0.28),
      0 1px 0 rgba(255, 255, 255, 0.45) inset;
  }

  .hlm-offers-wow-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 90% at 0% 0%, rgba(255, 255, 255, 0.38), transparent 50%),
      radial-gradient(ellipse 50% 80% at 100% 110%, rgba(120, 150, 60, 0.22), transparent 55%),
      linear-gradient(128deg, #96b648 0%, #A7C957 48%, #b8d46a 100%);
    z-index: 0;
  }

  .hlm-offers-wow-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.14) 50%,
      transparent 60%
    );
    animation: hlm-offers-shimmer 5.5s ease-in-out infinite;
    pointer-events: none;
  }

  .hlm-offers-wow-deco {
    position: absolute;
    pointer-events: none;
    z-index: 1;
    font-size: 2.4rem;
    line-height: 1;
    opacity: 0.22;
    filter: blur(0.2px);
  }

  .hlm-offers-wow-deco--gift {
    top: 0.35rem;
    right: 0.85rem;
    animation: hlm-offers-float 4.2s ease-in-out infinite;
  }

  .hlm-offers-wow-deco--spark {
    bottom: 2.8rem;
    right: 1.2rem;
    font-size: 1.5rem;
    opacity: 0.35;
    animation: hlm-offers-float 3.6s ease-in-out infinite reverse;
  }

  .hlm-offers-wow-main {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto auto;
    gap: 0.35rem 0.65rem;
    align-items: center;
    width: 100%;
    padding: 0.85rem 0.9rem 0.9rem;
    border: none;
    background: transparent;
    color: #1f3312;
    cursor: pointer;
    text-align: left;
    font: inherit;
  }

  .hlm-offers-wow-main:focus-visible {
    outline: 2px solid var(--highlight, #F7CE46);
    outline-offset: 3px;
    border-radius: 22px;
  }

  .hlm-offers-wow-top {
    grid-column: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem 0.55rem;
  }

  .hlm-offers-wow-live {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.22rem 0.55rem 0.22rem 0.42rem;
    border-radius: 999px;
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #1f3312;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  .hlm-offers-wow-live-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: #E03546;
    box-shadow: 0 0 0 2px rgba(224, 53, 70, 0.35);
    animation: hlm-offers-pulse 1.4s ease-in-out infinite;
  }

  .hlm-offers-wow-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.92;
  }

  .hlm-offers-wow-headline {
    grid-column: 1 / -1;
    margin: 0.15rem 0 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: clamp(1.05rem, 4.8vw, 1.28rem);
    line-height: 1.15;
    letter-spacing: -0.03em;
    text-shadow: none;
    animation: hlm-offers-line-in 0.45s ease both;
  }

  .hlm-offers-wow-meta {
    grid-column: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.45rem;
    margin-top: 0.1rem;
  }

  .hlm-offers-wow-tag {
    padding: 0.28rem 0.55rem;
    border-radius: 999px;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #2d4a1e;
    background: rgba(255, 255, 255, 0.45);
    border: 1px solid rgba(31, 51, 18, 0.14);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .hlm-offers-wow-cta {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.55rem 0.85rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #1A1C1A;
    background: linear-gradient(180deg, #FFE566 0%, #F7CE46 48%, #E8B923 100%);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.65);
    white-space: nowrap;
  }

  .hlm-offers-wow-cta-arrow {
    font-size: 0.85em;
    line-height: 1;
  }

  .hlm-offers-wow-plans {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.55rem 0.85rem 0.6rem;
    border: none;
    border-top: 1px solid rgba(31, 51, 18, 0.18);
    background: rgba(255, 255, 255, 0.28);
    color: #1f3312;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    cursor: pointer;
    font: inherit;
    font-size: 0.68rem;
    font-weight: 800;
  }

  .hlm-offers-wow-plans:focus-visible {
    outline: 2px solid var(--highlight, #F7CE46);
    outline-offset: -2px;
  }

  .hlm-offers-wow-plans-icon {
    font-size: 0.95rem;
    line-height: 1;
  }

  @media (max-width: 380px) {
    .hlm-offers-wow-main {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto auto;
    }
    .hlm-offers-wow-cta {
      grid-column: 1;
      grid-row: auto;
      justify-self: stretch;
      margin-top: 0.35rem;
      padding: 0.62rem 1rem;
    }
    .hlm-offers-wow-deco--gift {
      opacity: 0.12;
      right: 0.4rem;
    }
  }

  @media (min-width: 520px) {
    .hlm-offers-wow {
      border-radius: 26px;
    }
    .hlm-offers-wow-main {
      padding: 1rem 1.05rem 1.05rem;
      gap: 0.4rem 0.85rem;
    }
    .hlm-offers-wow-headline {
      grid-column: 1;
    }
    .hlm-offers-wow-meta {
      grid-column: 1;
    }
    .hlm-offers-wow-cta {
      grid-row: 1 / span 3;
      align-self: center;
      padding: 0.65rem 1.05rem;
      font-size: 0.72rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hlm-offers-wow-bg::after,
    .hlm-offers-wow-deco,
    .hlm-offers-wow-live-dot,
    .hlm-offers-wow-headline {
      animation: none;
    }
  }
`;

const ROTATING_LINES = [
  'Flash deals — today only',
  'Extra off on daily staples',
  'Top picks under ₹99',
  'Bundle more, save more',
];

function ensureCss() {
  if (typeof document === 'undefined') return;
  const id = 'hlm-shop-deals-rail-css';
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = OFFERS_CSS;
}

/** Full-width special offers hero — above category directory on shop home. */
export function ShopSpecialOffersBanner({
  dealsEnabled = true,
  showPlans = false,
  onOpenDeals,
  onOpenPlans,
}: Props) {
  ensureCss();
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % ROTATING_LINES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  function handleMainClick() {
    if (dealsEnabled && onOpenDeals) onOpenDeals();
    else if (showPlans && onOpenPlans) onOpenPlans();
  }

  const ctaLabel = dealsEnabled ? 'Browse deals' : showPlans ? 'See plans' : 'Shop & save';

  return (
    <div className="hlm-offers-wow" aria-label="Special offers">
      <div className="hlm-offers-wow-bg" aria-hidden />
      <span className="hlm-offers-wow-deco hlm-offers-wow-deco--gift" aria-hidden>
        🎁
      </span>
      <span className="hlm-offers-wow-deco hlm-offers-wow-deco--spark" aria-hidden>
        ✨
      </span>
      <button type="button" className="hlm-offers-wow-main" onClick={handleMainClick}>
        <div className="hlm-offers-wow-top">
          <span className="hlm-offers-wow-live">
            <span className="hlm-offers-wow-live-dot" aria-hidden />
            Live
          </span>
          <p className="hlm-offers-wow-title">Special offers</p>
        </div>
        <p className="hlm-offers-wow-headline" key={lineIndex} aria-live="polite">
          {ROTATING_LINES[lineIndex]}
        </p>
        <div className="hlm-offers-wow-meta">
          <span className="hlm-offers-wow-tag">Up to 20% off</span>
          <span className="hlm-offers-wow-tag">Town exclusives</span>
        </div>
        <span className="hlm-offers-wow-cta">
          {ctaLabel}
          <span className="hlm-offers-wow-cta-arrow" aria-hidden>
            →
          </span>
        </span>
      </button>
      {showPlans && onOpenPlans ? (
        <button type="button" className="hlm-offers-wow-plans" onClick={onOpenPlans}>
          <span className="hlm-offers-wow-plans-icon" aria-hidden>
            🚚
          </span>
          Free delivery plans — tap to view
        </button>
      ) : null}
    </div>
  );
}
