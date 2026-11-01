import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.koyakart.agent',
  appName: 'KoyaKart Agent',
  webDir: 'dist',
  android: {
    path: 'android-agent',
    allowMixedContent: true,
    backgroundColor: '#0f766e',
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    App: { disableBackButtonHandler: true },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f766e',
      showSpinner: false,
      launchFadeOutDuration: 220,
    },
    StatusBar: { style: 'DARK', backgroundColor: '#0f766e' },
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
  },
};

export default config;
