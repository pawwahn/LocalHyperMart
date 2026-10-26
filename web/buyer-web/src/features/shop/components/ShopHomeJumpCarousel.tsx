import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShopHomeJumpCard } from '../config/shopHomeJumpCards';
import { scrollToHomeRailSection } from '../config/shopHomeJumpCards';

const CAROUSEL_CSS = `
  @keyframes hlm-jump-shimmer {
    0% { transform: translateX(-120%) skewX(-12deg); opacity: 0; }
    35% { opacity: 0.35; }
    100% { transform: translateX(140%) skewX(-12deg); opacity: 0; }
  }

  .hlm-jump-carousel-wrap {
    margin: 0.55rem -0.85rem 0.75rem;
    width: calc(100% + 1.7rem);
    min-width: 0;
  }

  .hlm-jump-carousel-scroller {
    display: flex;
    gap: 0.65rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    padding: 0.15rem 0.85rem 0.55rem;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .hlm-jump-carousel-scroller::-webkit-scrollbar {
    display: none;
  }

  .hlm-jump-card {
    flex: 0 0 min(88vw, 19.5rem);
    scroll-snap-align: center;
    scroll-snap-stop: always;
    position: relative;
    min-height: 9.25rem;
    border: none;
    border-radius: 22px;
    padding: 0.95rem 0.85rem 0.85rem;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    box-shadow:
      0 12px 28px rgba(15, 23, 42, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
    transition: transform 160ms ease, box-shadow 160ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .hlm-jump-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.12) 50%,
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
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.35rem;
    align-items: stretch;
    min-height: 7.1rem;
  }

  .hlm-jump-card-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    min-width: 0;
    padding-right: 0.25rem;
  }

  .hlm-jump-card-tag {
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.2rem 0.45rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.28);
  }

  .hlm-jump-card--dark .hlm-jump-card-tag {
    background: rgba(255, 255, 255, 0.55);
    border-color: rgba(255, 255, 255, 0.65);
    color: #422006;
  }

  .hlm-jump-card-title {
    margin: 0;
    font-family: var(--font-display, var(--font-body));
    font-size: 1.05rem;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.03em;
  }

  .hlm-jump-card-sub {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.35;
    opacity: 0.92;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hlm-jump-card-cta {
    margin-top: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    padding: 0 0.85rem;
    border-radius: 999px;
    border: none;
    background: #fff;
    color: #1a1820;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  }

  .hlm-jump-card--light .hlm-jump-card-cta {
    color: #0C831F;
  }

  .hlm-jump-card-art {
    position: relative;
    width: 4.6rem;
    flex-shrink: 0;
    align-self: end;
  }

  .hlm-jump-card-emoji {
    position: absolute;
    line-height: 1;
    filter: drop-shadow(0 6px 12px rgba(15, 23, 42, 0.18));
  }

  .hlm-jump-carousel-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.1rem 0.85rem 0;
  }

  .hlm-jump-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #c4c0d4;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .hlm-jump-dot--on {
    background: #0C831F;
    transform: scale(1.15);
  }

  .hlm-jump-counter {
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #fff;
    background: rgba(15, 23, 42, 0.78);
    padding: 0.22rem 0.5rem;
    border-radius: 999px;
    min-width: 2.1rem;
    text-align: center;
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

  @media (min-width: 520px) {
    .hlm-jump-carousel-wrap {
      margin-left: 0;
      margin-right: 0;
      width: 100%;
    }
    .hlm-jump-carousel-scroller {
      padding-left: 0;
      padding-right: 0;
    }
    .hlm-jump-card {
      flex-basis: min(42vw, 20rem);
    }
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const syncIndex = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || cards.length === 0) return;
    const card = el.querySelector<HTMLElement>('.hlm-jump-card');
    if (!card) return;
    const stride = card.offsetWidth + 10;
    const i = Math.round(el.scrollLeft / stride);
    setIndex(Math.max(0, Math.min(cards.length - 1, i)));
  }, [cards.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncIndex, { passive: true });
    return () => el.removeEventListener('scroll', syncIndex);
  }, [syncIndex]);

  function goTo(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.hlm-jump-card');
    if (!card) return;
    const stride = card.offsetWidth + 10;
    el.scrollTo({ left: stride * i, behavior: 'smooth' });
    setIndex(i);
  }

  if (cards.length === 0) return null;

  return (
    <div className="hlm-jump-carousel-wrap" aria-label="Shop highlights">
      <style>{CAROUSEL_CSS}</style>
      <div ref={scrollerRef} className="hlm-jump-carousel-scroller">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`hlm-jump-card hlm-jump-card--${card.textTone}`}
            style={{ background: card.background }}
            onClick={() => scrollToHomeRailSection(card.sectionId)}
          >
            <div className="hlm-jump-card-inner">
              <div className="hlm-jump-card-copy">
                {card.brandTag ? <span className="hlm-jump-card-tag">{card.brandTag}</span> : null}
                <h3 className="hlm-jump-card-title">{card.title}</h3>
                <p className="hlm-jump-card-sub">{card.subtitle}</p>
                <span className="hlm-jump-card-cta">{card.ctaLabel} →</span>
              </div>
              <div className="hlm-jump-card-art" aria-hidden>
                {card.emojis.map((emoji, i) => (
                  <span
                    key={`${card.id}-${i}`}
                    className="hlm-jump-card-emoji"
                    style={{
                      fontSize: i === 0 ? '2.1rem' : i === 1 ? '1.65rem' : '1.35rem',
                      right: i === 0 ? '0.1rem' : i === 1 ? '0.5rem' : '0.2rem',
                      bottom: i === 0 ? '0.2rem' : i === 1 ? '1.8rem' : '0.05rem',
                      left: i === 2 ? '0.15rem' : 'auto',
                      zIndex: 3 - i,
                    }}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="hlm-jump-carousel-meta">
        {cards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            className={`hlm-jump-dot${i === index ? ' hlm-jump-dot--on' : ''}`}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goTo(i)}
          />
        ))}
        <span className="hlm-jump-counter">
          {index + 1}/{cards.length}
        </span>
      </div>
    </div>
  );
}
