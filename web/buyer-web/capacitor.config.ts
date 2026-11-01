import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Bundles the built shop into the APK (webDir: dist).
 * Do not set server.url in production — that loads a website and feels slow.
 *
 * Local APK talking to this PC’s gateway:
 *   set VITE_API_BASE_URL=http://10.0.2.2:8080  (emulator)
 *   or http://<your-lan-ip>:8080                 (physical phone)
 */
const config: CapacitorConfig = {
  appId: 'com.koyakart.buyer',
  appName: 'KoyaKart',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#009111',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    App: {
      disableBackButtonHandler: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#009111',
      showSpinner: false,
      launchFadeOutDuration: 220,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#009111',
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
