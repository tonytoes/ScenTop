// Used by `npm run android:demo`: a demo Android app that works with no internet and no server.
// Every API call is answered on the phone by src/app/demo/demo-backend.ts, from a built-in catalogue.
export const environment = {
  /** Empty: email-code and Google sign-in need the internet, so the demo app hides them. */
  neonAuthUrl: '',
  /** True only in the offline demo APK (npm run android:demo): the API is answered on the phone. */
  demo: true,
  production: true,
  /** Public address of the website, used in shared links. Empty means "the address the site is running on". */
  siteUrl: '',
  apiUrl: '/api',
};
