import { isNativeApp } from './platform';
import { injectNativeShellStyles } from './injectNativeShellStyles';

export type NativeBootstrapOptions = {
  /** Status bar / splash brand color (hex). */
  statusBarColor?: string;
};

export async function bootstrapNativeApp(options: NativeBootstrapOptions = {}): Promise<void> {
  if (!isNativeApp()) return;

  const statusBarColor = options.statusBarColor ?? '#009111';

  document.documentElement.classList.add('hlm-native');
  document.body.classList.add('hlm-native');
  injectNativeShellStyles();

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: statusBarColor });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* browser dev without native plugins */
  }

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    await Keyboard.setScroll({ isDisabled: false });
  } catch {
    /* optional */
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 220 });
  } catch {
    /* optional */
  }
}

export { isNativeApp } from './platform';
