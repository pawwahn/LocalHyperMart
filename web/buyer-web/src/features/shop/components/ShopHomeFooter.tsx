import { Link } from 'react-router-dom';
import { usePlatformBrand } from '@hlm-brand';
import { APP_NAME, defaultBrandLogoUrl } from '@/shared/brand';
import { useTown } from '@/shared/town/TownContext';

const FOOTER_CSS = `
  .hlm-shop-home-footer {
    margin: 1rem -0.85rem 0;
    padding: 0.85rem 0.85rem 0.75rem;
    background: #f3f4f4;
    border-top: 1px solid var(--border);
    color: var(--text);
    min-width: 0;
  }
  .hlm-shop-home-footer-grid {
    display: grid;
    gap: 0.65rem 0.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .hlm-shop-home-footer-brand {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    min-width: 0;
    padding-bottom: 0.15rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    margin-bottom: 0.1rem;
  }
  .hlm-shop-home-footer-logo img {
    height: 34px;
    width: auto;
    max-width: 140px;
    object-fit: contain;
    display: block;
  }
  .hlm-shop-home-footer-wordmark {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.1rem;
    letter-spacing: -0.03em;
    color: var(--accent);
    line-height: 1.1;
  }
  .hlm-shop-home-footer-copy {
    margin: 0;
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--text-muted);
    line-height: 1.25;
    text-align: right;
    flex-shrink: 0;
  }
  .hlm-shop-home-footer-tagline {
    display: none;
  }
  .hlm-shop-home-footer-col {
    display: grid;
    gap: 0.28rem;
    align-content: start;
    min-width: 0;
  }
  .hlm-shop-home-footer-col h3 {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text);
  }
  .hlm-shop-home-footer-col ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.22rem;
  }
  .hlm-shop-home-footer-col a,
  .hlm-shop-home-footer-col button {
    font: inherit;
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text-muted);
    text-decoration: none;
    text-align: left;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    line-height: 1.3;
  }
  .hlm-shop-home-footer-col a:hover,
  .hlm-shop-home-footer-col button:hover {
    color: var(--accent);
  }
  .hlm-shop-home-footer-towns-list {
    display: none;
  }
  .hlm-shop-home-footer-towns-btn {
    margin-top: 0.15rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.28rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #fff;
    font-size: 0.62rem !important;
    font-weight: 700 !important;
    color: var(--text) !important;
  }
  .hlm-shop-home-footer-local-copy {
    display: none;
  }
  .hlm-shop-home-footer-legal-row {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.55rem;
    justify-content: center;
    padding-top: 0.35rem;
    margin-top: 0.05rem;
    border-top: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
  }
  .hlm-shop-home-footer-legal-row a {
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--text-muted);
    text-decoration: none;
  }
  .hlm-shop-home-footer-legal-row a:hover {
    color: var(--accent);
  }
  .hlm-shop-home-footer-legal-col {
    display: none;
  }

  @media (min-width: 640px) {
    .hlm-shop-home-footer {
      padding: 1.35rem 0.85rem 1rem;
    }
    .hlm-shop-home-footer-grid {
      gap: 1rem 1.25rem;
    }
    .hlm-shop-home-footer-brand {
      display: grid;
      grid-template-columns: 1fr;
      justify-content: start;
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
      gap: 0.45rem;
    }
    .hlm-shop-home-footer-copy {
      text-align: left;
      font-size: 0.72rem;
    }
    .hlm-shop-home-footer-tagline {
      display: block;
      margin: 0;
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--text-muted);
      line-height: 1.45;
      max-width: 16rem;
    }
    .hlm-shop-home-footer-logo img {
      height: 40px;
      max-width: 180px;
    }
    .hlm-shop-home-footer-col h3 {
      font-size: 0.78rem;
      margin-bottom: 0.1rem;
    }
    .hlm-shop-home-footer-col ul {
      gap: 0.32rem;
    }
    .hlm-shop-home-footer-col a,
    .hlm-shop-home-footer-col button {
      font-size: 0.72rem;
    }
    .hlm-shop-home-footer-legal-row {
      display: none;
    }
    .hlm-shop-home-footer-legal-col {
      display: grid;
    }
    .hlm-shop-home-footer-towns-list {
      display: grid;
    }
    .hlm-shop-home-footer-local-copy {
      display: block;
    }
  }

  @media (min-width: 960px) {
    .hlm-shop-home-footer {
      padding: 2rem 1.25rem 1.5rem;
      margin-inline: -1.25rem;
    }
    .hlm-shop-home-footer-grid {
      grid-template-columns: minmax(0, 1.15fr) repeat(5, minmax(0, 1fr));
      gap: 1.25rem 1.75rem;
    }
    .hlm-shop-home-footer-brand {
      grid-column: auto;
    }
  }
`;

let footerCssInjected = false;
function ensureFooterCss() {
  if (footerCssInjected || typeof document === 'undefined') return;
  if (document.getElementById('hlm-shop-home-footer-css')) {
    footerCssInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'hlm-shop-home-footer-css';
  style.textContent = FOOTER_CSS;
  document.head.appendChild(style);
  footerCssInjected = true;
}

function cityLabel(displayName: string): string {
  const trimmed = displayName.replace(/\s*\(.*\)\s*$/, '').trim();
  return trimmed.split(',')[0]?.trim() || trimmed;
}

function FooterLink({ to, children }: { to: string; children: string }) {
  return (
    <li>
      <Link to={to}>{children}</Link>
    </li>
  );
}

/** Swiggy-style site footer for shop home — KoyaKart links and towns. */
export function ShopHomeFooter() {
  ensureFooterCss();
  const { logoSrc, appName, loading } = usePlatformBrand();
  const { towns, openPicker } = useTown();
  const brandLabel = appName?.trim() || APP_NAME;
  const footerLogo = logoSrc || defaultBrandLogoUrl();
  const year = new Date().getFullYear();
  const openTowns = towns.filter((t) => t.acceptingOrders);
  const featuredTowns = openTowns.slice(0, 6);

  return (
    <footer className="hlm-shop-home-footer" aria-label="Site footer">
      <div className="hlm-shop-home-footer-grid">
        <div className="hlm-shop-home-footer-brand">
          <div className="hlm-shop-home-footer-logo">
            {loading && !logoSrc ? (
              <span className="hlm-shop-home-footer-wordmark" aria-hidden>
                …
              </span>
            ) : (
              <img src={footerLogo} alt={brandLabel} decoding="async" />
            )}
          </div>
          <p className="hlm-shop-home-footer-copy">
            © {year} {brandLabel}
          </p>
          <p className="hlm-shop-home-footer-tagline">
            Groceries and essentials from trusted shops in your home town.
          </p>
        </div>

        <div className="hlm-shop-home-footer-col">
          <h3>Company</h3>
          <ul>
            <FooterLink to="/more">About</FooterLink>
            <FooterLink to="/categories">Categories</FooterLink>
            <FooterLink to="/membership">Delivery plans</FooterLink>
            <FooterLink to="/invite">Invite friends</FooterLink>
          </ul>
        </div>

        <div className="hlm-shop-home-footer-col">
          <h3>For you</h3>
          <ul>
            <FooterLink to="/orders">Orders</FooterLink>
            <FooterLink to="/wallet">Wallet</FooterLink>
            <FooterLink to="/addresses">Addresses</FooterLink>
            <FooterLink to="/cart">Basket</FooterLink>
          </ul>
        </div>

        <div className="hlm-shop-home-footer-col">
          <h3>Help</h3>
          <ul>
            <FooterLink to="/alerts">Alerts</FooterLink>
            <FooterLink to="/more">Settings</FooterLink>
            <FooterLink to="/spend">My spend</FooterLink>
          </ul>
        </div>

        <div className="hlm-shop-home-footer-col">
          <h3>Towns</h3>
          <ul className="hlm-shop-home-footer-towns-list">
            {featuredTowns.map((town) => (
              <li key={town.id}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {cityLabel(town.displayName)}
                </span>
              </li>
            ))}
            {featuredTowns.length === 0 ? (
              <li>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Coming soon</span>
              </li>
            ) : null}
          </ul>
          {openTowns.length > 0 ? (
            <button type="button" className="hlm-shop-home-footer-towns-btn" onClick={openPicker}>
              {openTowns.length} {openTowns.length === 1 ? 'town' : 'towns'} ▾
            </button>
          ) : null}
        </div>

        <div className="hlm-shop-home-footer-col hlm-shop-home-footer-legal-col">
          <h3>Legal</h3>
          <ul>
            <FooterLink to="/legal/terms">Terms</FooterLink>
            <FooterLink to="/legal/privacy">Privacy</FooterLink>
            <FooterLink to="/legal/refund">Refund</FooterLink>
          </ul>
          <h3 style={{ marginTop: '0.55rem' }}>Local</h3>
          <p className="hlm-shop-home-footer-local-copy" style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Supporting neighbourhood stores in every town we serve.
          </p>
        </div>

        <nav className="hlm-shop-home-footer-legal-row" aria-label="Legal">
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/refund">Refund</Link>
        </nav>
      </div>
    </footer>
  );
}
