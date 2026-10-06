import { useEffect, useState } from 'react';

type Props = {
  dealsEnabled?: boolean;
  showPlans?: boolean;
  onOpenDeals?: () => void;
  onOpenPlans?: () => void;
};

const OFFERS_CSS = `
  .hlm-shop-deals-rail {
    position: relative;
    display: flex;
    flex-direction: column;
    align-self: stretch;
    height: 100%;
    min-height: 0;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
    box-shadow:
      0 10px 28px color-mix(in srgb, var(--accent) 18%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
    background:
      radial-gradient(120% 80% at 0% 0%, rgba(247, 206, 70, 0.35), transparent 55%),
      radial-gradient(90% 70% at 100% 100%, rgba(255, 255, 255, 0.2), transparent 50%),
      linear-gradient(165deg, #0a6b1a 0%, #0C831F 42%, #149A2C 100%);
    color: #fff;
    isolation: isolate;
  }
  .hlm-shop-deals-rail::before {
    content: '';
    position: absolute;
    inset: -40% -60%;
    background: linear-gradient(
      115deg,
      transparent 42%,
      rgba(255, 255, 255, 0.22) 50%,
      transparent 58%
    );
    animation: hlm-deals-shine 4.2s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes hlm-deals-shine {
    0%, 100% { transform: translateX(-18%) rotate(8deg); opacity: 0; }
    35%, 55% { opacity: 1; }
    100% { transform: translateX(22%) rotate(8deg); opacity: 0; }
  }
  .hlm-shop-deals-rail-btn {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
    width: 100%;
    padding: 0.45rem 0.35rem 0.5rem;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: center;
    font: inherit;
  }
  .hlm-shop-deals-rail-btn:focus-visible {
    outline: 2px solid var(--highlight, #F7CE46);
    outline-offset: 2px;
  }
  .hlm-shop-deals-rail-badge {
    align-self: center;
    padding: 0.18rem 0.42rem;
    border-radius: 999px;
    font-size: 0.52rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: var(--highlight, #F7CE46);
    color: #0a3d12;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }
  .hlm-shop-deals-rail-hero {
    margin: 0.1rem 0 0;
    font-family: var(--font-display);
    font-weight: 900;
    font-size: clamp(0.62rem, 2.8vw, 0.78rem);
    line-height: 1.05;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }
  .hlm-shop-deals-rail-rotator {
    min-height: 2.5em;
    display: grid;
    place-items: center;
    padding: 0 0.15rem;
  }
  .hlm-shop-deals-rail-rotator span {
    font-size: clamp(0.58rem, 2.5vw, 0.72rem);
    font-weight: 800;
    line-height: 1.25;
    letter-spacing: 0.02em;
    animation: hlm-deals-fade 0.45s ease;
  }
  @keyframes hlm-deals-fade {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .hlm-shop-deals-rail-chips {
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
    padding-top: 0.15rem;
  }
  .hlm-shop-deals-rail-chip {
    display: block;
    padding: 0.28rem 0.25rem;
    border-radius: 8px;
    font-size: clamp(0.48rem, 2.1vw, 0.58rem);
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: 0.03em;
    background: rgba(255, 255, 255, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(4px);
  }
  .hlm-shop-deals-rail-cta {
    margin-top: 0.2rem;
    font-size: clamp(0.5rem, 2.2vw, 0.6rem);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.95;
  }
  .hlm-shop-deals-rail-plans {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    margin: auto 0.35rem 0.4rem 0.35rem;
    padding: 0.32rem 0.25rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    background: rgba(0, 0, 0, 0.12);
    color: #fff;
    font-size: clamp(0.48rem, 2.1vw, 0.56rem);
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
  }
  @media (min-width: 768px) {
    .hlm-shop-deals-rail {
      border-radius: 16px;
    }
    .hlm-shop-deals-rail-btn {
      padding: 0.55rem 0.45rem 0.6rem;
      gap: 0.45rem;
    }
    .hlm-shop-deals-rail-hero {
      font-size: 0.82rem;
    }
  }
`;

const ROTATING_LINES = [
  '⚡ Flash deals today',
  '🎁 Extra off on staples',
  '🔥 Top picks under ₹99',
  '🛒 Bundle & save more',
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

/** Sticky vertical promo rail beside the category grid — Swiggy / Instamart style. */
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

  return (
    <aside className="hlm-shop-deals-rail" aria-label="Special offers">
      <button type="button" className="hlm-shop-deals-rail-btn" onClick={handleMainClick}>
        <span className="hlm-shop-deals-rail-badge">Live</span>
        <p className="hlm-shop-deals-rail-hero">Special offers</p>
        <div className="hlm-shop-deals-rail-rotator" aria-live="polite">
          <span key={lineIndex}>{ROTATING_LINES[lineIndex]}</span>
        </div>
        <div className="hlm-shop-deals-rail-chips">
          <span className="hlm-shop-deals-rail-chip">Up to 20% off</span>
          <span className="hlm-shop-deals-rail-chip">Town exclusives</span>
        </div>
        <span className="hlm-shop-deals-rail-cta">
          {dealsEnabled ? 'Tap to browse ›' : showPlans ? 'See plans ›' : 'Shop & save ›'}
        </span>
      </button>
      {showPlans && onOpenPlans ? (
        <button type="button" className="hlm-shop-deals-rail-plans" onClick={onOpenPlans}>
          Free delivery plans
        </button>
      ) : null}
    </aside>
  );
}
