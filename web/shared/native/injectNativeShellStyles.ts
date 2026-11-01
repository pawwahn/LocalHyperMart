/** WebView-friendly scrolling and touch; only meaningful once `hlm-native` is on `<html>`. */
export function injectNativeShellStyles(): void {
  if (document.getElementById('hlm-native-shell-styles')) return;
  const style = document.createElement('style');
  style.id = 'hlm-native-shell-styles';
  style.textContent = `
    html.hlm-native {
      height: 100%;
      height: 100dvh;
      overscroll-behavior: none;
    }
    html.hlm-native body {
      height: 100%;
      overflow: hidden;
      overscroll-behavior: none;
      user-select: none;
      -webkit-user-select: none;
    }
    html.hlm-native #root {
      height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: none;
      -webkit-overflow-scrolling: touch;
    }
    html.hlm-native input,
    html.hlm-native textarea,
    html.hlm-native [contenteditable="true"] {
      user-select: text;
      -webkit-user-select: text;
    }
    html.hlm-native .hlm-product-card:hover {
      transform: none;
      box-shadow: var(--shadow-card);
    }
  `;
  document.head.appendChild(style);
}
