// Development and the website: the Angular dev server proxies /api to the Express server
// (proxy.conf.json), and in production Express serves the website itself, so /api is same-origin.
export const environment = {
  production: false,
  /** Public address of the website, used in shared links. Empty means "the address the site is running on". */
  siteUrl: '',
  apiUrl: '/api',
};
