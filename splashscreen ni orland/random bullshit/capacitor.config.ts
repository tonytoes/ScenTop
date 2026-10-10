import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.scentop.app',
  appName: 'ScenTop',
  webDir: 'www',
  plugins: {
   SplashScreen: {
  launchAutoHide: false,
  backgroundColor: '#fffbed',
  androidScaleType: 'CENTER_CROP',
  showSpinner: false,
},
  },
};

export default config;  