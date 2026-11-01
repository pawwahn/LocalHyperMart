/** Minimal types so portals can compile shared native without hoisting Capacitor into `web/shared`. */
declare module '@capacitor/core' {
  export const Capacitor: {
    isNativePlatform(): boolean;
    getPlatform(): string;
  };
}

declare module '@capacitor/push-notifications' {
  export const PushNotifications: {
    requestPermissions(): Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
    register(): Promise<void>;
    addListener(
      event: 'registration',
      handler: (ev: { value: string }) => void,
    ): Promise<{ remove(): Promise<void> }>;
    addListener(
      event: 'registrationError',
      handler: (ev: { error: string }) => void,
    ): Promise<{ remove(): Promise<void> }>;
  };
}

declare module '@capacitor/app' {
  export const App: {
    addListener(
      event: 'backButton',
      handler: (ev: { canGoBack: boolean }) => void,
    ): Promise<{ remove(): Promise<void> }>;
    minimizeApp(): Promise<void>;
  };
}

declare module '@capacitor/status-bar' {
  export const StatusBar: {
    setOverlaysWebView(opts: { overlay: boolean }): Promise<void>;
    setBackgroundColor(opts: { color: string }): Promise<void>;
    setStyle(opts: { style: unknown }): Promise<void>;
  };
  export const Style: { Dark: unknown };
}

declare module '@capacitor/keyboard' {
  export const Keyboard: {
    setResizeMode(opts: { mode: unknown }): Promise<void>;
    setScroll(opts: { isDisabled: boolean }): Promise<void>;
  };
  export const KeyboardResize: { Native: unknown };
}

declare module '@capacitor/splash-screen' {
  export const SplashScreen: {
    hide(opts: { fadeOutDuration: number }): Promise<void>;
  };
}
