// Used by `npm run build:mobile`, the build that is bundled into the Android app.
// The app is not served by your server, so it needs the full address of the deployed API.
// Replace this with your own URL, e.g. https://scentop.onrender.com/api
export const environment = {
  /** Public Neon Auth URL. Empty keeps the new buttons hidden. */
  neonAuthUrl: 'https://ep-curly-moon-b46gdsbd.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth',
  /** True only in the offline demo APK (npm run android:demo): the API is answered on the phone. */
  demo: false,
  production: true,
  /** Public address of the website, used in shared links. Empty means "the address the site is running on". */
  siteUrl: 'https://scentop.example.com',
  apiUrl: 'https://scentop.example.com/api',
};
