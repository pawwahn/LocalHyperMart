import { APP_NAME, DEFAULT_BRAND_LOGO_SIZE, defaultBrandLogoUrl } from '@/shared/brand';

type Props = {
  showPlans?: boolean;
  onOpenPlans?: () => void;
};

const BAND_CSS = `
  .hlm-home-promo-band {
    display: grid;
    grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
    min-height: clamp(7.1rem, 16vw, 8.6rem);
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 10px 28px rgba(12, 131, 31, 0.2),
      0 1px 0 rgba(255, 255, 255, 0.35) inset;
    min-width: 0;
    align-items: stretch;
  }
  .hlm-home-promo-band-primary {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    padding: 0.7rem 0.8rem;
    background:
      radial-gradient(ellipse 70% 90% at 0% 0%, rgba(247, 206, 70, 0.22), transparent 48%),
      radial-gradient(ellipse 50% 80% at 100% 110%, rgba(4, 60, 16, 0.35), transparent 55%),
      linear-gradient(128deg, #0A6E1C 0%, #0C831F 42%, #16A334 78%, #0B721C 100%);
    color: #fff;
    min-width: 0;
  }
  .hlm-home-promo-band-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 36%, rgba(255, 255, 255, 0.14) 50%, transparent 64%);
    pointer-events: none;
  }
  .hlm-home-promo-band-primary-copy {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 0.38rem;
    min-width: 0;
  }
  .hlm-home-promo-save {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: clamp(0.78rem, 2.1vw, 0.98rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.92);
  }
  .hlm-home-promo-pills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.32rem;
    min-width: 0;
  }
  .hlm-home-promo-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    padding: 0.18rem 0.46rem 0.2rem 0.34rem;
    border-radius: 999px;
    background: var(--highlight, #F7CE46);
    color: #0a3d12;
    box-shadow: 0 2px 0 rgba(10, 61, 18, 0.12);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: clamp(0.68rem, 1.9vw, 0.86rem);
    letter-spacing: 0.04em;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .hlm-home-promo-pill svg {
    width: 0.92em;
    height: 0.92em;
    flex-shrink: 0;
  }
  .hlm-home-promo-band-title {
    margin: 0;
    font-size: clamp(0.72rem, 1.85vw, 0.9rem);
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.88);
  }
  .hlm-promo-local {
    display: inline-block;
    padding: 0.02em 0.28em 0.05em;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
  }
  .hlm-home-promo-band-plans {
    justify-self: start;
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 800;
    border-radius: 999px;
    padding: 0.32rem 0.66rem;
    min-height: 32px;
    cursor: pointer;
    letter-spacing: -0.01em;
    backdrop-filter: blur(6px);
  }
  .hlm-home-promo-band-plans:hover {
    background: rgba(255, 255, 255, 0.26);
  }
  .hlm-home-promo-band-art {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 0.28rem;
    flex-shrink: 0;
  }
  .hlm-home-promo-art-orb {
    width: 2.05rem;
    height: 2.05rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #FFF6CC;
    box-shadow: 0 4px 10px rgba(4, 40, 12, 0.18);
  }
  .hlm-home-promo-art-orb svg {
    width: 1.05rem;
    height: 1.05rem;
  }
  .hlm-home-promo-band-secondary {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.28fr);
    align-items: stretch;
    gap: 0.35rem 0.45rem;
    padding: 0.45rem 0.5rem 0.45rem 0.85rem;
    min-width: 0;
    min-height: 100%;
    overflow: hidden;
    border-left: 1px solid rgba(12, 131, 31, 0.1);
    background:
      radial-gradient(ellipse 55% 90% at 100% 50%, rgba(247, 206, 70, 0.18), transparent 58%),
      radial-gradient(ellipse 80% 70% at 0% 100%, rgba(12, 131, 31, 0.12), transparent 52%),
      linear-gradient(128deg, #f5fbf7 0%, #ffffff 42%, #e9f5ec 100%);
  }
  .hlm-home-promo-band-secondary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.45) 50%, transparent 60%);
    pointer-events: none;
    opacity: 0.65;
  }
  .hlm-home-promo-brand-copy {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.28rem;
    min-width: 0;
    height: 100%;
    padding: 0.15rem 0;
    overflow: visible;
  }
  .hlm-home-promo-brand-stack {
    max-width: 100%;
    min-width: 0;
  }
  .hlm-home-promo-brand-title-block {
    display: grid;
    width: max-content;
    max-width: 100%;
    min-width: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: clamp(0.78rem, 2.9vw, 1.05rem);
    line-height: 1.12;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #064d14;
  }
  .hlm-home-promo-brand-title-line {
    display: block;
    white-space: nowrap;
  }
  .hlm-home-promo-brand-title-block em {
    font-style: normal;
    display: block;
    text-align: center;
    font-size: 1.06em;
    letter-spacing: 0.05em;
    word-spacing: 0.15em;
    background: linear-gradient(120deg, #086318 0%, #0C831F 55%, #0a6b1a 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .hlm-home-promo-brand-sub {
    margin: 0;
    text-align: center;
    white-space: nowrap;
    font-size: clamp(0.5rem, 2.35vw, 0.68rem);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #5a7260;
    line-height: 1.25;
  }
  .hlm-home-promo-brand-logo-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    width: 100%;
    height: 100%;
    max-height: 100%;
    padding: 0.15rem 0.2rem 0.15rem 0;
  }
  .hlm-home-promo-brand-logo {
    width: auto;
    height: 100%;
    max-height: min(7.35rem, 100%);
    max-width: 100%;
    min-height: 4.75rem;
    object-fit: contain;
    object-position: center right;
    display: block;
    filter: drop-shadow(0 3px 10px rgba(12, 131, 31, 0.14));
    image-rendering: auto;
  }
  @media (max-width: 640px) {
    .hlm-home-promo-band {
      grid-template-columns: 1fr;
      min-height: 0;
    }
    .hlm-home-promo-band-primary {
      grid-template-columns: 1fr;
      padding: 0.72rem 0.75rem 0.78rem;
      gap: 0.45rem;
    }
    .hlm-home-promo-band-art {
      display: none;
    }
    .hlm-home-promo-save {
      font-size: 0.78rem;
    }
    .hlm-home-promo-pill {
      font-size: 0.7rem;
      padding: 0.2rem 0.42rem 0.22rem 0.32rem;
    }
    .hlm-home-promo-band-title {
      font-size: 0.74rem;
    }
    .hlm-home-promo-band-art {
      align-self: start;
      padding-top: 0.1rem;
    }
    .hlm-home-promo-art-orb {
      width: 1.75rem;
      height: 1.75rem;
    }
    .hlm-home-promo-band-secondary {
      border-left: none;
      border-top: 1px solid rgba(12, 131, 31, 0.1);
      min-height: 5.1rem;
      padding: 0.5rem 0.65rem;
      grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr);
    }
    .hlm-home-promo-brand-title-block {
      font-size: clamp(0.68rem, 3.1vw, 0.88rem);
    }
    .hlm-home-promo-brand-sub {
      letter-spacing: 0.04em;
      font-size: clamp(0.46rem, 2.15vw, 0.62rem);
      text-align: left;
    }
    .hlm-home-promo-brand-logo {
      min-height: 4.1rem;
      max-height: 5.1rem;
    }
  }
  @media (min-width: 768px) {
    .hlm-home-promo-band {
      border-radius: 18px;
    }
    .hlm-home-promo-band-primary {
      padding: 0.9rem 1.05rem;
      gap: 0.75rem;
    }
    .hlm-home-promo-save {
      font-size: clamp(0.88rem, 1.35vw, 1.05rem);
    }
    .hlm-home-promo-pill {
      font-size: clamp(0.78rem, 1.15vw, 0.95rem);
      padding: 0.26rem 0.58rem 0.28rem 0.42rem;
    }
    .hlm-home-promo-band-secondary {
      padding: 0.5rem 0.65rem 0.5rem 1rem;
      gap: 0.5rem;
    }
    .hlm-home-promo-brand-title-block {
      font-size: clamp(0.82rem, 1.45vw, 1.12rem);
      line-height: 1.1;
    }
    .hlm-home-promo-brand-logo {
      min-height: 5.75rem;
      max-height: 7rem;
    }
    .hlm-home-promo-art-orb {
      width: 2.25rem;
      height: 2.25rem;
    }
  }
  @media (min-width: 1024px) {
    .hlm-home-promo-brand-title-block {
      font-size: clamp(0.95rem, 1.25vw, 1.22rem);
    }
    .hlm-home-promo-brand-logo {
      min-height: 6.5rem;
      max-height: 7.35rem;
    }
  }
`;

function ensureBandCss() {
  if (typeof document === 'undefined') return;
  let style = document.getElementById('hlm-home-promo-band-css') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'hlm-home-promo-band-css';
    document.head.appendChild(style);
  }
  style.textContent = BAND_CSS;
}

function IconFuel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 20V7.2A1.7 1.7 0 0 1 8.2 5.5h5.1A1.7 1.7 0 0 1 15 7.2V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M5.2 20h11.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M15 10.2h1.4a2 2 0 0 1 2 2V16a1.4 1.4 0 1 0 2.8 0V9.6L19.4 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.4V12l2.4 1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13.2 3.6 6.4 13.1h5l-1 7.3 7.2-10.2h-5l1.6-6.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Home promo band — save petrol, time & energy + brand showcase. */
export function DeliveryHero({ showPlans, onOpenPlans }: Props) {
  ensureBandCss();
  const logoUrl = defaultBrandLogoUrl();

  return (
    <section className="hlm-home-promo-band" aria-label="Save your petrol, time and energy">
      <div className="hlm-home-promo-band-primary">
        <div className="hlm-home-promo-band-primary-copy">
          <p className="hlm-home-promo-save">Save your</p>
          <div className="hlm-home-promo-pills">
            <span className="hlm-home-promo-pill">
              <IconFuel />
              PETROL
            </span>
            <span className="hlm-home-promo-pill">
              <IconClock />
              TIME
            </span>
            <span className="hlm-home-promo-pill">
              <IconBolt />
              ENERGY
            </span>
          </div>
          <p className="hlm-home-promo-band-title">
            Everything from your <span className="hlm-promo-local">local</span> stores
          </p>
          {showPlans && onOpenPlans ? (
            <button type="button" className="hlm-home-promo-band-plans" onClick={onOpenPlans}>
              Free delivery plans ›
            </button>
          ) : null}
        </div>
        <div className="hlm-home-promo-band-art" aria-hidden>
          <span className="hlm-home-promo-art-orb">
            <IconFuel />
          </span>
          <span className="hlm-home-promo-art-orb">
            <IconClock />
          </span>
          <span className="hlm-home-promo-art-orb">
            <IconBolt />
          </span>
        </div>
      </div>
      <div className="hlm-home-promo-band-secondary" aria-label={APP_NAME}>
        <div className="hlm-home-promo-brand-copy">
          <div className="hlm-home-promo-brand-stack">
            <div className="hlm-home-promo-brand-title-block">
              <span className="hlm-home-promo-brand-title-line">Your Home Town</span>
              <em>Market Place</em>
              <p className="hlm-home-promo-brand-sub">Your town · your kart</p>
            </div>
          </div>
        </div>
        <div className="hlm-home-promo-brand-logo-wrap">
          <img
            className="hlm-home-promo-brand-logo"
            src={logoUrl}
            alt={APP_NAME}
            width={DEFAULT_BRAND_LOGO_SIZE.width}
            height={DEFAULT_BRAND_LOGO_SIZE.height}
            decoding="async"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}
