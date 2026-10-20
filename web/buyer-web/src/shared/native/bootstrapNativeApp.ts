import { Capacitor } from '@capacitor/core';

/** True only inside the Android (or iOS) shell — never in Chrome. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function bootstrapNativeApp(): Promise<void> {
  if (!isNativeApp()) return;

  document.documentElement.classList.add('hlm-native');
  document.body.classList.add('hlm-native');

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#0C831F' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* plugin missing in browser */
  }

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    await Keyboard.setScroll({ isDisabled: false });
  } catch {
    /* plugin missing in browser */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 220 });
  } catch {
    /* plugin missing in browser */
  }
}
