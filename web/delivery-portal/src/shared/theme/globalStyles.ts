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
      --shell-max: 1100px;
      --tabbar-h: 72px;
      --touch-min: 44px;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { min-height: 100%; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      font-family: var(--font-body);
      background:
        radial-gradient(ellipse at 12% -10%, rgba(37, 99, 235, 0.12), transparent 42%),
        radial-gradient(ellipse at 92% 8%, rgba(16, 185, 129, 0.08), transparent 38%),
        var(--bg);
      color: var(--text);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
      padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
    }
    button, input, select, textarea { font: inherit; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    button, a, [role="button"] { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    a { color: var(--accent); }
    @media (max-width: 767px) {
      :root { --shell-max: 100%; --tabbar-h: 68px; }
      input, select, textarea { font-size: 16px !important; }
    }
    @keyframes hlm-fade-up {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
