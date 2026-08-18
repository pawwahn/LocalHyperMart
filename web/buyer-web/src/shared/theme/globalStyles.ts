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
      --shell-max: 560px;
      --tabbar-h: 64px;
      --sticky-cart-h: 64px;
      --touch-min: 44px;
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
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
      letter-spacing: -0.015em;
      -webkit-font-smoothing: antialiased;
      padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
    }
    .hlm-search-input::placeholder {
      color: #8a8a8a;
      opacity: 1;
    }
    .hlm-product-card {
      transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease;
    }
    .hlm-product-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
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
      transform: scale(1.04);
      box-shadow: 0 4px 14px rgba(12, 131, 31, 0.28);
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
      :root { --tabbar-h: 60px; }
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
  `;
  document.head.appendChild(style);
}
