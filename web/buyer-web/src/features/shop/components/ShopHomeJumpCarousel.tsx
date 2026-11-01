import type { CSSProperties } from 'react';
import type { ShopHomeJumpCard } from '../config/shopHomeJumpCards';
import { scrollToHomeRailSection } from '../config/shopHomeJumpCards';
import { JumpCardIcon } from './JumpCardIcons';

const CAROUSEL_CSS = `
  .hlm-jump-carousel-wrap {
    margin: 0.35rem 0 0.65rem;
    width: 100%;
    min-width: 0;
  }

  .hlm-jump-carousel-track {
    display: flex;
    gap: 0.55rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 0.15rem;
    padding: 0.2rem 0.05rem 0.45rem;
    -webkit-overflow-scrolling: touch;
  }

  .hlm-jump-carousel-track::-webkit-scrollbar {
    display: none;
  }

  .hlm-jump-card {
    position: relative;
    flex: 0 0 min(42vw, 168px);
    min-width: 136px;
    max-width: 168px;
    scroll-snap-align: start;
    min-height: 9.35rem;
    border: none;
    border-radius: 16px;
    padding: 0.62rem 0.58rem 0.55rem;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.65) inset,
      0 8px 22px color-mix(in srgb, var(--jump-accent, var(--accent)) 14%, rgba(16, 24, 40, 0.12));
    transition:
      transform 180ms ease,
      box-shadow 180ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .hlm-jump-card:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.7) inset,
      0 12px 28px color-mix(in srgb, var(--jump-accent, var(--accent)) 18%, rgba(16, 24, 40, 0.14));
  }

  .hlm-jump-card:active {
    transform: scale(0.98);
  }

  .hlm-jump-card-glow {
    position: absolute;
    top: -28%;
    right: -22%;
    width: 72%;
    aspect-ratio: 1;
    border-radius: 999px;
    background: radial-gradient(
      circle at 40% 40%,
      color-mix(in srgb, var(--jump-accent, var(--accent)) 38%, transparent),
      transparent 68%
    );
    pointer-events: none;
    opacity: 0.55;
  }

  .hlm-jump-card-art {
    position: absolute;
    right: 0.35rem;
    bottom: 0.35rem;
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: color-mix(in srgb, #fff 72%, transparent);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--jump-accent, var(--accent)) 12%, rgba(0, 0, 0, 0.08));
    pointer-events: none;
    transform: rotate(-6deg);
  }

  .hlm-jump-card-art svg {
    width: 26px !important;
    height: 26px !important;
  }

  .hlm-jump-card-tag {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.18rem 0.42rem;
    border-radius: 999px;
    line-height: 1;
    background: color-mix(in srgb, #fff 78%, transparent);
    backdrop-filter: blur(6px);
    box-shadow: 0 1px 4px rgba(16, 24, 40, 0.06);
  }

  .hlm-jump-card-title {
    position: relative;
    z-index: 1;
    margin: 0.42rem 0 0;
    padding-right: 0.15rem;
    font-family: var(--font-display);
    font-size: 0.82rem;
    font-weight: 800;
    line-height: 1.18;
    letter-spacing: -0.03em;
    color: var(--text);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hlm-jump-card-sub {
    position: relative;
    z-index: 1;
    margin: 0.22rem 0 0;
    padding-right: 2.4rem;
    font-size: 0.64rem;
    font-weight: 500;
    line-height: 1.35;
    color: color-mix(in srgb, var(--text) 52%, var(--text-muted));
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hlm-jump-card-cta {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    margin-top: 0.48rem;
    padding: 0.28rem 0.52rem;
    border-radius: 999px;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1;
    background: color-mix(in srgb, #fff 82%, transparent);
    box-shadow: 0 2px 8px rgba(16, 24, 40, 0.08);
  }

  .hlm-jump-card-cta-arrow {
    font-size: 0.72rem;
    line-height: 1;
    opacity: 0.85;
  }

  .hlm-home-rail-flash {
    animation: hlm-rail-flash 900ms ease;
  }

  @keyframes hlm-rail-flash {
    0%, 100% { box-shadow: none; }
    30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 12px; }
  }

  .hlm-home-rail-anchor {
    scroll-margin-top: 4.75rem;
  }

  @media (min-width: 900px) {
    .hlm-jump-carousel-track {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      overflow: visible;
      scroll-snap-type: none;
      gap: 0.65rem;
      padding-inline: 0;
    }

    .hlm-jump-card {
      flex: unset;
      min-width: 0;
      max-width: none;
      min-height: 9.75rem;
    }

    .hlm-jump-card-title {
      font-size: 0.88rem;
    }

    .hlm-jump-card-sub {
      font-size: 0.68rem;
    }
  }
`;

type Props = {
  cards: ShopHomeJumpCard[];
};

function jumpCardSurface(accent: string): CSSProperties {
  return {
    ['--jump-accent' as string]: accent,
    background: `linear-gradient(152deg, #ffffff 0%, color-mix(in srgb, ${accent} 8%, #fff) 42%, color-mix(in srgb, ${accent} 20%, #fff) 100%)`,
    border: `1px solid color-mix(in srgb, ${accent} 16%, var(--border))`,
  };
}

export function ShopHomeJumpCarousel({ cards }: Props) {
  if (cards.length === 0) return null;

  return (
    <div className="hlm-jump-carousel-wrap" aria-label="Shop highlights">
      <style>{CAROUSEL_CSS}</style>
      <div className="hlm-jump-carousel-track hlm-hide-scrollbar">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="hlm-jump-card"
            style={jumpCardSurface(card.accent)}
            onClick={() => scrollToHomeRailSection(card.sectionId)}
          >
            <span className="hlm-jump-card-glow" aria-hidden />
            {card.brandTag ? (
              <span className="hlm-jump-card-tag" style={{ color: card.accent }}>
                {card.brandTag}
              </span>
            ) : null}
            <h3 className="hlm-jump-card-title">{card.title}</h3>
            <p className="hlm-jump-card-sub">{card.subtitle}</p>
            <span className="hlm-jump-card-cta" style={{ color: card.accent }}>
              {card.ctaLabel}
              <span className="hlm-jump-card-cta-arrow" aria-hidden>
                →
              </span>
            </span>
            <span className="hlm-jump-card-art" aria-hidden>
              <JumpCardIcon id={card.icon} color={card.accent} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
