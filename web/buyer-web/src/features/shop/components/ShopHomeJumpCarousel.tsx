import type { ShopHomeJumpCard } from '../config/shopHomeJumpCards';
import { scrollToHomeRailSection } from '../config/shopHomeJumpCards';

const GRID_CSS = `
  @keyframes hlm-jump-shimmer {
    0% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
    35% { opacity: 0.35; }
    100% { transform: translateX(140%) skewX(-12deg); opacity: 0; }
  }

  .hlm-jump-carousel-wrap {
    margin: 0.55rem 0 0.65rem;
    width: 100%;
    min-width: 0;
  }

  .hlm-jump-carousel-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem;
    min-width: 0;
  }

  .hlm-jump-card {
    position: relative;
    min-height: 0;
    border: none;
    border-radius: 14px;
    padding: 0.45rem 0.42rem 0.48rem;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    box-shadow:
      0 8px 18px rgba(15, 23, 42, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
    transition: transform 160ms ease;
    -webkit-tap-highlight-color: transparent;
    min-width: 0;
  }

  .hlm-jump-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 60%
    );
    animation: hlm-jump-shimmer 4.5s ease-in-out infinite;
    pointer-events: none;
  }

  .hlm-jump-card:active {
    transform: scale(0.985);
  }

  .hlm-jump-card--light {
    color: #fff;
  }

  .hlm-jump-card--dark {
    color: #1a1820;
  }

  .hlm-jump-card-inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.22rem;
    min-height: 6.5rem;
    min-width: 0;
  }

  .hlm-jump-card-tag {
    font-size: 0.48rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.12rem 0.32rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.28);
    line-height: 1.2;
  }

  .hlm-jump-card--dark .hlm-jump-card-tag {
    background: rgba(255, 255, 255, 0.55);
    border-color: rgba(255, 255, 255, 0.65);
    color: #422006;
  }

  .hlm-jump-card-title {
    margin: 0;
    font-family: var(--font-display, var(--font-body));
    font-size: clamp(0.62rem, 2.4vw, 0.78rem);
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.03em;
  }

  .hlm-jump-card-sub {
    margin: 0;
    font-size: clamp(0.5rem, 1.85vw, 0.6rem);
    font-weight: 600;
    line-height: 1.28;
    opacity: 0.92;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex: 1;
    min-height: 0;
  }

  .hlm-jump-card-cta {
    margin-top: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 1.55rem;
    padding: 0 0.42rem;
    border-radius: 999px;
    border: none;
    background: #fff;
    color: #1a1820;
    font-size: clamp(0.48rem, 1.7vw, 0.58rem);
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
    white-space: nowrap;
    max-width: 100%;
  }

  .hlm-jump-card--light .hlm-jump-card-cta {
    color: #0C831F;
  }

  .hlm-jump-card-emoji-row {
    position: absolute;
    right: 0.2rem;
    bottom: 0.15rem;
    font-size: 0.85rem;
    line-height: 1;
    opacity: 0.85;
    pointer-events: none;
    filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.15));
  }

  .hlm-home-rail-flash {
    animation: hlm-rail-flash 900ms ease;
  }

  @keyframes hlm-rail-flash {
    0%, 100% { box-shadow: none; }
    30% { box-shadow: 0 0 0 3px rgba(12, 131, 31, 0.42); border-radius: 12px; }
  }

  .hlm-home-rail-anchor {
    scroll-margin-top: 4.75rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .hlm-jump-card::after {
      animation: none;
    }
  }
`;

type Props = {
  cards: ShopHomeJumpCard[];
};

export function ShopHomeJumpCarousel({ cards }: Props) {
  if (cards.length === 0) return null;

  return (
    <div className="hlm-jump-carousel-wrap" aria-label="Shop highlights">
      <style>{GRID_CSS}</style>
      <div className="hlm-jump-carousel-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`hlm-jump-card hlm-jump-card--${card.textTone}`}
            style={{ background: card.background }}
            onClick={() => scrollToHomeRailSection(card.sectionId)}
          >
            <div className="hlm-jump-card-inner">
              {card.brandTag ? <span className="hlm-jump-card-tag">{card.brandTag}</span> : null}
              <h3 className="hlm-jump-card-title">{card.title}</h3>
              <p className="hlm-jump-card-sub">{card.subtitle}</p>
              <span className="hlm-jump-card-cta">{card.ctaLabel} →</span>
            </div>
            <span className="hlm-jump-card-emoji-row" aria-hidden>
              {card.emojis[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
