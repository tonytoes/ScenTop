import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The app's unique id on Google Play. Changing it later means publishing a new app, so pick it once.
  appId: 'com.scentop.app',
  appName: 'ScenTop',
  // `npm run build:mobile` writes the website here and Capacitor copies it into the Android app
  webDir: 'www',
  server: {
    // The app is served from https://localhost inside the phone. The API allows this origin (see server/app.ts).
    androidScheme: 'https',
  },
  android: {
    // Not needed in the Play Store build. Set true only to test against a plain http:// API on your own network.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // The animated welcome page inside the app takes over after this short native splash
      launchShowDuration: 600,
      launchAutoHide: false,
      backgroundColor: '#fffaf1',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#fffaf1',
    },
  },
};

export default config;
