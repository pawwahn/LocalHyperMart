import { tokens } from './tokens';

export function injectGlobalStyles(): void {
  if (document.getElementById('hlm-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'hlm-global-styles';
  style.textContent = `
    :root {
      --bg: ${tokens.color.bg};
      --bg-elevated: ${tokens.color.bgElevated};
      --bg-muted: ${tokens.color.bgMuted};
      --bg-tint: ${tokens.color.bgTint};
      --border: ${tokens.color.border};
      --text: ${tokens.color.text};
      --text-muted: ${tokens.color.textMuted};
      --text-inverse: ${tokens.color.textInverse};
      --accent: ${tokens.color.accent};
      --accent-hover: ${tokens.color.accentHover};
      --accent-soft: ${tokens.color.accentSoft};
      --hero: ${tokens.color.hero};
      --hero-deep: ${tokens.color.heroDeep};
      --highlight: ${tokens.color.highlight};
      --highlight-soft: ${tokens.color.highlightSoft};
      --danger: ${tokens.color.danger};
      --danger-soft: ${tokens.color.dangerSoft};
      --warning: ${tokens.color.warning};
      --warning-soft: ${tokens.color.warningSoft};
      --info: ${tokens.color.info};
      --success: ${tokens.color.success};
      --success-soft: ${tokens.color.successSoft};
      --font-display: ${tokens.font.display};
      --font-body: ${tokens.font.body};
      --radius-sm: ${tokens.radius.sm};
      --radius-md: ${tokens.radius.md};
      --radius-lg: ${tokens.radius.lg};
      --radius-xl: ${tokens.radius.xl};
      --radius-full: ${tokens.radius.full};
      --shadow-card: ${tokens.shadow.card};
      --shadow-elevated: ${tokens.shadow.elevated};
      --shadow-soft: ${tokens.shadow.soft};
      --motion-fast: ${tokens.motion.fast};
      --motion-normal: ${tokens.motion.normal};
      --shell-pad: 0.85rem;
      --shell-max: min(100vw - 1.7rem, 560px);
      --tabbar-h: 64px;
      --sticky-cart-h: 56px;
      --touch-min: 44px;
    }
    @media (min-width: 768px) {
      :root {
        --shell-pad: 1.15rem;
        --shell-max: min(100vw - 2.25rem, 1080px);
      }
    }
    @media (min-width: 1024px) {
      :root {
        --shell-pad: 1.35rem;
        --shell-max: min(100vw - 2.5rem, 1320px);
      }
    }
    @media (min-width: 1280px) {
      :root {
        --shell-pad: 1.5rem;
        --shell-max: min(100vw - 3rem, 1520px);
      }
    }
    @media (min-width: 1600px) {
      :root {
        --shell-max: min(1680px, calc(100vw - 3.5rem));
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    html {
      min-height: 100%;
      overflow-x: hidden;
      max-width: 100%;
      -webkit-text-size-adjust: 100%;
    }
    body, #root {
      min-height: 100%;
      overflow-x: hidden;
      max-width: 100%;
    }
    body {
      margin: 0;
      font-family: var(--font-body);
      background:
        radial-gradient(ellipse 55% 42% at 8% -8%, rgba(12, 131, 31, 0.11), transparent 52%),
        radial-gradient(ellipse 45% 38% at 94% 4%, rgba(12, 131, 31, 0.07), transparent 48%),
        var(--bg);
      color: var(--text);
      line-height: 1.45;
      letter-spacing: -0.015em;
      -webkit-font-smoothing: antialiased;
      padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
    }
    @media (min-width: 1024px) {
      #root {
        padding-top: 0.4rem;
      }
      .hlm-buyer-shell {
        background: color-mix(in srgb, var(--bg-elevated) 94%, white);
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--border) 65%, transparent),
          0 18px 48px rgba(16, 24, 40, 0.06);
        border-radius: 20px 20px 0 0;
        min-height: calc(100vh - 0.4rem);
      }
      .hlm-buyer-tabbar {
        border-radius: 18px 18px 0 0;
        border-left: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        border-right: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        overflow: hidden;
      }
    }
    .hlm-search-input::placeholder {
      color: #8B9394;
      opacity: 1;
    }
    .hlm-product-card {
      transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease;
    }
    .hlm-product-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 22px rgba(16, 24, 40, 0.1);
    }
    .hlm-product-card:active {
      transform: translateY(-1px) scale(0.99);
    }
    @media (hover: none) {
      .hlm-product-card:hover {
        transform: none;
        box-shadow: none;
      }
    }
    .hlm-add-btn {
      transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms ease, background 160ms ease;
    }
    .hlm-add-btn:hover:not(:disabled) {
      transform: scale(1.03);
      background: var(--accent-soft);
      box-shadow: 0 2px 8px rgba(12, 131, 31, 0.16);
    }
    .hlm-add-btn:active:not(:disabled) {
      transform: scale(0.96);
    }
    .hlm-cart-bar {
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .hlm-cart-bar:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 34px rgba(12, 131, 31, 0.42);
    }
    .hlm-aisle-tile {
      transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms ease, border-color 160ms ease;
    }
    .hlm-aisle-tile:active {
      transform: scale(0.94);
    }
    .hlm-brand-tagline {
      opacity: 0.9;
      animation: hlm-fade-up 320ms ease both;
    }
    @media (max-width: 379px) {
      .hlm-brand-tagline { display: none; }
    }
    button, input, select, textarea { font: inherit; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    button, a, [role="button"] { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    a { color: var(--accent); }
    @media (max-width: 767px) {
      :root {
        --tabbar-h: 60px;
        --shell-max: 100%;
        --shell-pad: 0.85rem;
      }
      input, select, textarea { font-size: 16px !important; }
    }
    ::selection { background: var(--highlight); color: #0a1a08; }
    @keyframes hlm-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes hlm-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
    @keyframes hlm-slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes hlm-hero-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes hlm-pop {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes hlm-wiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-4deg); }
      75% { transform: rotate(4deg); }
    }
    @keyframes hlm-balloon-rise {
      0% { transform: translate3d(0, 12vh, 0) rotate(-5deg); opacity: 0; }
      12% { opacity: 0.95; }
      55% { transform: translate3d(18px, -52vh, 0) rotate(6deg); }
      100% { transform: translate3d(-12px, -118vh, 0) rotate(-4deg); opacity: 0.25; }
    }
    @keyframes hlm-celebration-pop {
      from { opacity: 0; transform: translateY(14px) scale(0.94); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .hlm-order-balloon { animation: none !important; bottom: 8% !important; opacity: 0.35; }
    }
    .hlm-hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .hlm-hide-scrollbar::-webkit-scrollbar { display: none; }

    .hlm-home-category-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem 0.45rem;
      width: 100%;
      min-width: 0;
      align-content: start;
    }
    @media (min-width: 640px) {
      .hlm-home-category-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.65rem 0.5rem;
      }
    }
    @media (min-width: 1024px) {
      .hlm-home-category-grid {
        grid-template-columns: repeat(9, minmax(0, 1fr));
        gap: 0.7rem 0.55rem;
      }
    }
    @media (min-width: 1280px) {
      .hlm-home-category-grid {
        grid-template-columns: repeat(10, minmax(0, 1fr));
        gap: 0.75rem 0.6rem;
      }
    }

    .hlm-shop-product-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
      width: 100%;
      min-width: 0;
    }
    @media (min-width: 640px) {
      .hlm-shop-product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (min-width: 900px) {
      .hlm-shop-product-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.65rem;
      }
    }
    @media (min-width: 1100px) {
      .hlm-shop-product-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0.75rem;
      }
    }
    @media (min-width: 1280px) {
      .hlm-shop-product-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.8rem;
      }
    }
    @media (min-width: 1520px) {
      .hlm-shop-product-grid {
        grid-template-columns: repeat(7, minmax(0, 1fr));
      }
    }

    @media (min-width: 768px) {
      .hlm-shop-chrome-card {
        border-radius: 18px !important;
      }
    }
  `;
  document.head.appendChild(style);
}
