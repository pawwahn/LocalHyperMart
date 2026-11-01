import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.koyakart.hub',
  appName: 'KoyaKart Hub',
  webDir: 'dist',
  android: {
    path: 'android-hub',
    allowMixedContent: true,
    backgroundColor: '#2563eb',
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    App: { disableBackButtonHandler: true },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#2563eb',
      showSpinner: false,
      launchFadeOutDuration: 220,
    },
    StatusBar: { style: 'DARK', backgroundColor: '#2563eb' },
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
  },
};

export default config;
