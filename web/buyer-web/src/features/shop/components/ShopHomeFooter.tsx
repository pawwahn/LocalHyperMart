import { Link } from 'react-router-dom';
import { usePlatformBrand } from '@hlm-brand';
import { APP_NAME, defaultBrandLogoUrl } from '@/shared/brand';
import { useTown } from '@/shared/town/TownContext';

const FOOTER_CSS = `
  .hlm-shop-home-footer {
    margin: 0.75rem -0.85rem 0;
    padding: 0.7rem 0.85rem 0.6rem;
    background: color-mix(in srgb, var(--accent-soft) 62%, var(--bg));
    border-top: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
    color: var(--text);
    min-width: 0;
  }
  .hlm-shop-home-footer-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    min-width: 0;
    padding-bottom: 0.5rem;
    margin-bottom: 0.55rem;
    border-bottom: 1px solid color-mix(in srgb, var(--accent) 16%, var(--border));
  }
  .hlm-shop-home-footer-brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }
  .hlm-shop-home-footer-logo img {
    height: 30px;
    width: auto;
    max-width: 108px;
    object-fit: contain;
    display: block;
  }
  .hlm-shop-home-footer-wordmark,
  .hlm-shop-home-footer-name {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.95rem;
    letter-spacing: -0.03em;
    color: var(--accent);
    line-height: 1.1;
  }
  .hlm-shop-home-footer-tagline {
    margin: 0.08rem 0 0;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    line-height: 1.3;
  }
  .hlm-shop-home-footer-copy {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .hlm-shop-home-footer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem 1rem;
  }
  .hlm-shop-home-footer-col {
    display: grid;
    gap: 0.22rem;
    align-content: start;
    min-width: 0;
  }
  .hlm-shop-home-footer-col-head {
    display: flex;
    align-items: baseline;
    justify-content: flex-start;
    gap: 0.45rem;
    min-width: 0;
  }
  .hlm-shop-home-footer-col h3 {
    margin: 0;
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .hlm-shop-home-footer-change {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-size: 0.68rem;
    font-weight: 800;
    color: var(--accent);
    cursor: pointer;
  }
  .hlm-shop-home-footer-col ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.16rem;
  }
  .hlm-shop-home-footer-col a {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text);
    text-decoration: none;
    line-height: 1.35;
  }
  .hlm-shop-home-footer-col a:hover,
  .hlm-shop-home-footer-change:hover {
    text-decoration: underline;
  }
  .hlm-shop-home-footer-towns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.28rem;
  }
  .hlm-shop-home-footer-town {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0.05rem 0.48rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
    background: var(--bg-elevated);
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1.2;
  }
  .hlm-shop-home-footer-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.3rem 0.75rem;
    margin-top: 0.55rem;
    padding-top: 0.45rem;
    border-top: 1px solid color-mix(in srgb, var(--accent) 16%, var(--border));
  }
  .hlm-shop-home-footer-local {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    line-height: 1.35;
  }
  .hlm-shop-home-footer-legal {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.7rem;
  }
  .hlm-shop-home-footer-legal a {
    font-size: 0.68rem;
    font-weight: 800;
    color: var(--text);
    text-decoration: none;
  }
  .hlm-shop-home-footer-legal a:hover {
    color: var(--accent);
  }
  @media (max-width: 719px) {
    .hlm-shop-home-footer-tagline { display: none; }
    .hlm-shop-home-footer-towns-col { grid-column: 1 / -1; }
  }
  @media (min-width: 720px) {
    .hlm-shop-home-footer {
      margin-inline: -1.25rem;
      padding-inline: 1.25rem;
    }
    .hlm-shop-home-footer-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.55rem 1.25rem;
    }
  }
`;

function ensureFooterCss() {
  if (typeof document === 'undefined') return;
  let style = document.getElementById('hlm-shop-home-footer-css');
  if (!style) {
    style = document.createElement('style');
    style.id = 'hlm-shop-home-footer-css';
    document.head.appendChild(style);
  }
  style.textContent = FOOTER_CSS;
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

/** Shop-home footer: brand, account links, towns, and legal. */
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
      <div className="hlm-shop-home-footer-top">
        <div className="hlm-shop-home-footer-brand">
          <div className="hlm-shop-home-footer-logo">
            {loading && !logoSrc ? (
              <span className="hlm-shop-home-footer-wordmark" aria-hidden>
                …
              </span>
            ) : (
              <img src={footerLogo} alt="" decoding="async" />
            )}
          </div>
          <div>
            <p className="hlm-shop-home-footer-name">{brandLabel}</p>
            <p className="hlm-shop-home-footer-tagline">
              Groceries and essentials from trusted shops in your home town.
            </p>
          </div>
        </div>
        <p className="hlm-shop-home-footer-copy">© {year}</p>
      </div>

      <div className="hlm-shop-home-footer-grid">
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

        <div className="hlm-shop-home-footer-col hlm-shop-home-footer-towns-col">
          <div className="hlm-shop-home-footer-col-head">
            <h3>Towns</h3>
            {openTowns.length > 0 ? (
              <button type="button" className="hlm-shop-home-footer-change" onClick={openPicker}>
                Change
              </button>
            ) : null}
          </div>
          <div className="hlm-shop-home-footer-towns">
            {featuredTowns.length === 0 ? (
              <span className="hlm-shop-home-footer-town">Coming soon</span>
            ) : (
              featuredTowns.map((town) => (
                <span key={town.id} className="hlm-shop-home-footer-town">
                  {cityLabel(town.displayName)}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="hlm-shop-home-footer-bar">
        <p className="hlm-shop-home-footer-local">
          Supporting neighbourhood stores in every town we serve.
        </p>
        <nav className="hlm-shop-home-footer-legal" aria-label="Legal">
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/refund">Refund</Link>
        </nav>
      </div>
    </footer>
  );
}
