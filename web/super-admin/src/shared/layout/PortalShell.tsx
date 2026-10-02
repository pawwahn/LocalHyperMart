import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeaderIconButton, ThemePicker } from '@hlm-theme';
import { useAuth } from '@/shared/auth/AuthContext';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void;
};

type NavIcon =
  | 'overview'
  | 'reports'
  | 'memberships'
  | 'towns'
  | 'scratch'
  | 'ads'
  | 'hubs'
  | 'orders'
  | 'claims'
  | 'customers'
  | 'vendors'
  | 'billing'
  | 'agents'
  | 'catalog'
  | 'recipes'
  | 'listings'
  | 'payouts'
  | 'settings';

type NavItem = { to: string; label: string; icon: NavIcon };

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Operate',
    items: [
      { to: '/dashboard', label: 'Overview', icon: 'overview' },
      { to: '/reports', label: 'Reports', icon: 'reports' },
      { to: '/orders', label: 'Orders', icon: 'orders' },
      { to: '/claims', label: 'Claims', icon: 'claims' },
    ],
  },
  {
    label: 'Network',
    items: [
      { to: '/towns', label: 'Towns', icon: 'towns' },
      { to: '/hubs', label: 'Hubs', icon: 'hubs' },
      { to: '/vendors', label: 'Vendors', icon: 'vendors' },
      { to: '/agents', label: 'Agents', icon: 'agents' },
      { to: '/customers', label: 'Customers', icon: 'customers' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { to: '/catalog', label: 'Catalog', icon: 'catalog' },
      { to: '/recipes', label: 'Meal recipes', icon: 'recipes' },
      { to: '/store-listings', label: 'Listings', icon: 'listings' },
      { to: '/ads', label: 'Ads', icon: 'ads' },
      { to: '/scratch-cards', label: 'Scratch', icon: 'scratch' },
      { to: '/memberships', label: 'Memberships', icon: 'memberships' },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/vendor-billing', label: 'Billing', icon: 'billing' },
      { to: '/settlements', label: 'Payouts', icon: 'payouts' },
    ],
  },
  {
    label: 'Platform',
    items: [{ to: '/settings', label: 'Settings', icon: 'settings' }],
  },
];

export function PortalShell({ title, subtitle, children, onRefresh }: Props) {
  const { session, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNavOpen(false);
    }
    document.body.classList.add('sa-nav-lock');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('sa-nav-lock');
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

  return (
    <div className="sa-app">
      <style>{shellCss}</style>
      {navOpen ? (
        <button type="button" className="sa-backdrop" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      ) : null}

      <aside className={`sa-sidebar${navOpen ? ' is-open' : ''}`} aria-label="Super admin">
        <div className="sa-brand">
          <span className="sa-mark" aria-hidden>
            H
          </span>
          <div className="sa-brand-text">
            <p className="sa-brand-name">KoYaKart</p>
            <p className="sa-brand-role">Super Admin</p>
          </div>
        </div>

        <nav className="sa-nav" aria-label="Primary">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="sa-nav-group">
              <p className="sa-nav-label">{group.label}</p>
              {group.items.map((item) => {
                const active = isNavActive(location.pathname, item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`sa-nav-link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="sa-nav-ico" aria-hidden>
                      <NavGlyph name={item.icon} />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {session?.phone ? (
          <div className="sa-sidebar-foot">
            <span className="sa-sidebar-foot-k">Signed in</span>
            <span className="sa-sidebar-foot-v">{session.phone}</span>
          </div>
        ) : null}
      </aside>

      <div className="sa-workspace">
        <header className="sa-topbar">
          <button
            type="button"
            className="sa-menu-btn"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          >
            <MenuGlyph />
          </button>
          <div className="sa-topbar-title-wrap">
            <h1 className="sa-topbar-title">{title}</h1>
            {subtitle ? <p className="sa-topbar-sub">{subtitle}</p> : null}
            {session?.phone ? <span className="sa-topbar-phone">{session.phone}</span> : null}
          </div>
          <div className="sa-topbar-actions">
            <ThemePicker />
            {onRefresh ? (
              <HeaderIconButton label="Refresh" onClick={onRefresh}>
                ↻
              </HeaderIconButton>
            ) : null}
            <HeaderIconButton label="Sign out" onClick={logout}>
              ⎋
            </HeaderIconButton>
          </div>
        </header>
        <main className="sa-main">{children}</main>
      </div>
    </div>
  );
}

function isNavActive(current: string, to: string): boolean {
  if (to === '/dashboard') return current === '/dashboard';
  return current === to || current.startsWith(`${to}/`);
}

function MenuGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function NavGlyph({ name }: { name: NavIcon }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      {GLYPHS[name]}
    </svg>
  );
}

const stroke = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const GLYPHS: Record<NavIcon, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" {...stroke} />
      <rect x="13" y="3" width="8" height="8" rx="1.5" {...stroke} />
      <rect x="3" y="13" width="8" height="8" rx="1.5" {...stroke} />
      <rect x="13" y="13" width="8" height="8" rx="1.5" {...stroke} />
    </>
  ),
  reports: (
    <>
      <path d="M4 20h16" {...stroke} />
      <path d="M7 16v-4M12 16V8M17 16v-7" {...stroke} />
    </>
  ),
  memberships: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" {...stroke} />
      <path d="M3 10h18M8 14h4" {...stroke} />
    </>
  ),
  towns: (
    <>
      <path d="M12 21s-7-6.6-7-11a7 7 0 0 1 14 0c0 4.4-7 11-7 11z" {...stroke} />
      <circle cx="12" cy="10" r="2.2" {...stroke} />
    </>
  ),
  scratch: (
    <path
      d="M12 3l1.4 5.2L19 9.5l-5.6 1.3L12 16l-1.4-5.2L5 9.5l5.6-1.3L12 3z"
      {...stroke}
    />
  ),
  ads: (
    <>
      <path d="M4 10v4h3l6 4V6l-6 4H4z" {...stroke} />
      <path d="M16.5 8.5a4.5 4.5 0 0 1 0 7" {...stroke} />
    </>
  ),
  hubs: (
    <>
      <path d="M4 21V8l8-4 8 4v13" {...stroke} />
      <path d="M9 21v-6h6v6M12 8v.01" {...stroke} />
    </>
  ),
  orders: (
    <>
      <path d="M6 8h12l-1 13H7L6 8z" {...stroke} />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" {...stroke} />
    </>
  ),
  claims: <path d="M12 3l8 3.5v6.2c0 4.6-3.2 8-8 9.8-4.8-1.8-8-5.2-8-9.8V6.5L12 3z" {...stroke} />,
  customers: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...stroke} />
      <circle cx="9" cy="7" r="3.2" {...stroke} />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16.5 3.2a3.2 3.2 0 0 1 0 6.2" {...stroke} />
    </>
  ),
  vendors: (
    <>
      <path d="M3 10 5 4h14l2 6" {...stroke} />
      <path d="M3 10v10h18V10M9 20v-6h6v6" {...stroke} />
    </>
  ),
  billing: (
    <>
      <path d="M7 3h10v18l-2.2-1.4L12 21l-2.8-1.4L7 21V3z" {...stroke} />
      <path d="M10 8h4M10 12h4M10 16h3" {...stroke} />
    </>
  ),
  agents: (
    <>
      <circle cx="8" cy="16.5" r="2.4" {...stroke} />
      <circle cx="17" cy="16.5" r="2.4" {...stroke} />
      <path d="M10.3 16.2 13 8h4l1.6 3.6H21" {...stroke} />
      <path d="M8 10h3" {...stroke} />
    </>
  ),
  catalog: (
    <>
      <path d="M12 3 21 8l-9 5L3 8l9-5z" {...stroke} />
      <path d="M3 12l9 5 9-5M3 16.5 12 21.5 21 16.5" {...stroke} />
    </>
  ),
  recipes: (
    <>
      <path d="M4 10h16v10H4z" {...stroke} />
      <path d="M8 6c0-2 2-3 4-3s4 1 4 3" {...stroke} />
      <path d="M8 14h8" {...stroke} />
    </>
  ),
  listings: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" {...stroke} />
      <path d="M3 6h.01M3 12h.01M3 18h.01" {...stroke} />
    </>
  ),
  payouts: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" {...stroke} />
      <circle cx="12" cy="12" r="2.2" {...stroke} />
      <path d="M6.5 12h.01M17.5 12h.01" {...stroke} />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" {...stroke} />
      <path
        d="M12 3.5v2.1M12 18.4v2.1M4.6 6.5l1.5 1.5M17.9 16l1.5 1.5M3.5 12h2.1M18.4 12h2.1M4.6 17.5l1.5-1.5M17.9 8l1.5-1.5"
        {...stroke}
      />
    </>
  ),
};

const shellCss = `
  .sa-nav-lock { overflow: hidden; }

  .sa-app {
    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
    align-items: stretch;
  }

  .sa-backdrop {
    display: none;
  }

  .sa-sidebar {
    width: 228px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-elevated);
    border-right: 1px solid var(--border);
    position: sticky;
    top: 0;
    height: 100vh;
    height: 100dvh;
    z-index: 40;
  }

  .sa-brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.85rem 0.85rem 0.7rem;
    border-bottom: 1px solid var(--border);
  }

  .sa-mark {
    width: 2rem;
    height: 2rem;
    border-radius: 0.55rem;
    background: var(--accent);
    color: var(--text-inverse);
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.92rem;
    flex-shrink: 0;
  }

  .sa-brand-text { min-width: 0; }
  .sa-brand-name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--text);
  }
  .sa-brand-role {
    margin: 0.08rem 0 0;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  .sa-nav {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.45rem 0.5rem 0.7rem;
    scrollbar-width: thin;
  }

  .sa-nav-group + .sa-nav-group { margin-top: 0.45rem; }
  .sa-nav-label {
    margin: 0 0 0.2rem;
    padding: 0.2rem 0.55rem;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .sa-nav-link {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.82rem;
    padding: 0.38rem 0.55rem 0.38rem 0.6rem;
    border-radius: 0.55rem;
    min-height: 2.05rem;
    line-height: 1.2;
  }
  .sa-nav-link:hover { color: var(--text); background: var(--bg-muted); }
  .sa-nav-link.is-active {
    color: var(--accent-hover);
    background: var(--accent-soft);
    font-weight: 700;
  }
  .sa-nav-link.is-active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 22%;
    bottom: 22%;
    width: 3px;
    border-radius: 999px;
    background: var(--accent);
  }
  .sa-nav-ico {
    width: 1.05rem;
    height: 1.05rem;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .sa-sidebar-foot {
    border-top: 1px solid var(--border);
    padding: 0.65rem 0.9rem 0.8rem;
    display: grid;
    gap: 0.08rem;
  }
  .sa-sidebar-foot-k {
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .sa-sidebar-foot-v {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text);
  }

  .sa-workspace {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .sa-topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 3.35rem;
    padding: 0.45rem 1rem;
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
  }

  .sa-menu-btn {
    display: none;
    width: var(--touch-min);
    height: var(--touch-min);
    min-width: var(--touch-min);
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    border-radius: 999px;
    color: var(--text);
    cursor: pointer;
    place-items: center;
    flex-shrink: 0;
  }

  .sa-topbar-title-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.55rem;
  }
  .sa-topbar-sub {
    margin: 0;
    width: 100%;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    line-height: 1.25;
  }
  .sa-topbar-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.15rem, 2.4vw, 1.4rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .sa-topbar-phone {
    display: none;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .sa-topbar-actions {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    flex-shrink: 0;
  }

  .sa-main {
    display: grid;
    gap: 0.75rem;
    padding: 0.85rem 1rem 2rem;
  }

  @media (max-width: 960px) {
    .sa-menu-btn { display: grid; }
    .sa-topbar-phone { display: inline; }
    .sa-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      border: 0;
      padding: 0;
      background: rgba(17, 24, 28, 0.38);
      z-index: 45;
    }
    .sa-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      transform: translateX(-105%);
      transition: transform 0.2s ease;
      box-shadow: var(--shadow-elevated);
      z-index: 50;
    }
    .sa-sidebar.is-open { transform: translateX(0); }
  }
`;
