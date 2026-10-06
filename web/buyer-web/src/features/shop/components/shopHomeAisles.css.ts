/** Injected once on shop home — promo row + full-width aisles below. */

export const SHOP_HOME_AISLES_CSS = `

  .hlm-shop-home-sections {

    display: flex;

    flex-direction: column;

    gap: 1.05rem;

    width: 100%;

    min-width: 0;

  }

  .hlm-shop-home-aisles {

    display: grid;

    grid-template-columns: clamp(4.65rem, 21vw, 5.85rem) minmax(0, 1fr);

    gap: 0.4rem;

    align-items: stretch;

    width: 100%;

    min-width: 0;

  }

  .hlm-shop-home-directory {

    display: grid;

    grid-template-columns: repeat(3, minmax(0, 1fr));

    gap: 0.75rem 0.4rem;

    align-content: start;

    min-width: 0;

  }

  .hlm-shop-home-directory .hlm-aisle-heading-full,

  .hlm-shop-home-directory .hlm-mid-ad-full {

    grid-column: 1 / -1;

  }

  .hlm-shop-home-directory .hlm-mid-ad-full {

    margin: 0.1rem 0;

  }

  .hlm-shop-home-aisle-full {

    width: 100%;

    min-width: 0;

  }

  .hlm-shop-home-directory--full {

    display: grid;

    grid-template-columns: repeat(3, minmax(0, 1fr));

    gap: 0.75rem 0.4rem;

    align-content: start;

    width: 100%;

    min-width: 0;

  }

  .hlm-shop-home-directory--full .hlm-aisle-heading-full,

  .hlm-shop-home-directory--full .hlm-mid-ad-full {

    grid-column: 1 / -1;

  }

  .hlm-shop-home-directory--full .hlm-mid-ad-full {

    margin: 0.1rem 0;

  }

  @media (min-width: 520px) {

    .hlm-shop-home-aisles {

      grid-template-columns: clamp(5.25rem, 18vw, 7rem) minmax(0, 1fr);

      gap: 0.5rem;

    }

  }

  @media (min-width: 768px) {

    .hlm-shop-home-aisles {

      grid-template-columns: clamp(6.5rem, 11vw, 9.5rem) minmax(0, 1fr);

      gap: 0.65rem;

    }

    .hlm-shop-home-aisles .hlm-shop-home-directory {

      grid-template-columns: repeat(4, minmax(0, 1fr));

      gap: 0.85rem 0.5rem;

    }

    .hlm-shop-home-directory--full {

      grid-template-columns: repeat(4, minmax(0, 1fr));

      gap: 0.85rem 0.5rem;

    }

  }

  @media (min-width: 1024px) {

    .hlm-shop-home-aisles {

      grid-template-columns: clamp(7rem, 9vw, 10.5rem) minmax(0, 1fr);

      gap: 0.75rem;

    }

    .hlm-shop-home-aisles .hlm-shop-home-directory,

    .hlm-shop-home-directory--full {

      grid-template-columns: repeat(5, minmax(0, 1fr));

      gap: 0.9rem 0.55rem;

    }

  }

  @media (min-width: 1280px) {

    .hlm-shop-home-aisles .hlm-shop-home-directory,

    .hlm-shop-home-directory--full {

      grid-template-columns: repeat(6, minmax(0, 1fr));

      gap: 1rem 0.6rem;

    }

  }

  @media (min-width: 1520px) {

    .hlm-shop-home-aisles .hlm-shop-home-directory,

    .hlm-shop-home-directory--full {

      grid-template-columns: repeat(7, minmax(0, 1fr));

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

