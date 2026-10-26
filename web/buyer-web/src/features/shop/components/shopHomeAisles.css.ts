/** Shop home category grid — ss1 / ss2 (Blinkit-style directory). */

export const SHOP_HOME_AISLES_CSS = `
  .hlm-shop-home-offers-strip {
    margin: 0 0 0.65rem;
  }

  .hlm-shop-home-categories {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    min-width: 0;
    background: #ffffff;
    margin: 0 -0.85rem;
    padding: 0.85rem 0.85rem 1.35rem;
    border-radius: 18px 18px 0 0;
    box-shadow: 0 -2px 12px rgba(15, 23, 42, 0.04);
  }

  .hlm-shop-home-aisle-full {
    width: 100%;
    min-width: 0;
  }

  .hlm-aisle-heading-full {
    grid-column: 1 / -1;
    margin: 0 0 0.7rem;
    padding: 0;
    font-family: var(--font-body, var(--font-display));
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    color: #2f2d36;
  }

  .hlm-shop-home-directory,
  .hlm-shop-home-directory--full {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    column-gap: 0.38rem;
    row-gap: 0.75rem;
    align-content: start;
    width: 100%;
    min-width: 0;
  }

  .hlm-shop-home-directory .hlm-mid-ad-full,
  .hlm-shop-home-directory--full .hlm-mid-ad-full {
    grid-column: 1 / -1;
    margin: 0.2rem 0 0.35rem;
  }

  .hlm-cat-tile {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.38rem;
    border: none;
    background: transparent;
    padding: 0;
    margin: 0;
    cursor: pointer;
    color: inherit;
    min-width: 0;
    width: 100%;
    font: inherit;
    text-align: center;
    -webkit-tap-highlight-color: transparent;
  }

  .hlm-cat-tile-visual {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    overflow: hidden;
    background: #e8f4fc;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 140ms ease;
  }

  .hlm-cat-tile-visual--emoji {
    background: #e8f4fc;
  }

  .hlm-cat-tile-photo {
    width: 90%;
    height: 90%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    object-position: center center;
    display: block;
    pointer-events: none;
  }

  .hlm-cat-tile-collage {
    position: relative;
    width: 82%;
    aspect-ratio: 1 / 1;
  }

  .hlm-cat-tile-emoji {
    position: absolute;
    left: 50%;
    top: 50%;
    line-height: 1;
    transform-origin: center;
    filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.08));
  }

  .hlm-cat-tile-label {
    margin: 0;
    padding: 0 0.05rem;
    font-size: 0.625rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.015em;
    text-align: center;
    color: #1c1a22;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hlm-cat-tile:active .hlm-cat-tile-visual {
    transform: scale(0.96);
  }

  @media (min-width: 520px) {
    .hlm-shop-home-categories {
      margin-left: 0;
      margin-right: 0;
      border-radius: 20px;
    }

    .hlm-aisle-heading-full {
      font-size: 1rem;
    }

    .hlm-cat-tile-label {
      font-size: 0.6875rem;
    }
  }
`;

export function ensureShopHomeAislesCss() {
  if (typeof document === 'undefined') return;
  const id = 'hlm-shop-home-aisles-css';
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = SHOP_HOME_AISLES_CSS;
}
