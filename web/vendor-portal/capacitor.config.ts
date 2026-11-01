import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Vendor portal in APK (webDir: dist). Web dev unchanged via Vite proxy.
 * Physical phone → build with VITE_API_BASE_URL=http://<LAN-IP>:8080
 */
const config: CapacitorConfig = {
  appId: 'com.koyakart.vendor',
  appName: 'KoyaKart Vendor',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1B8B4C',
  },
  plugins: {
    App: {
      disableBackButtonHandler: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#1B8B4C',
      showSpinner: false,
      launchFadeOutDuration: 220,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1B8B4C',
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
