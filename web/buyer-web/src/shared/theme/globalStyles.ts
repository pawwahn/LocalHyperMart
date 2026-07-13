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
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { min-height: 100%; }
    body {
      margin: 0;
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
    }
    button, input, select, textarea { font: inherit; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    a { color: var(--accent); }
    ::selection { background: var(--accent-soft); color: var(--accent-hover); }
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
    .hlm-hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .hlm-hide-scrollbar::-webkit-scrollbar { display: none; }
  `;
  document.head.appendChild(style);
}
