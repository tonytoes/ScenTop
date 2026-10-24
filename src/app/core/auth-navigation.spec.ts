import { safeAuthRedirect } from './auth-navigation';

describe('passwordless redirects', () => {
  it('preserves local checkout navigation', () => {
    expect(safeAuthRedirect('/checkout?from=cart')).toBe('/checkout?from=cart');
  });
  it('rejects external, malformed and recursive auth destinations', () => {
    for (const value of ['https://evil.test', '//evil.test', '/%2fevil.test', '/\\evil.test', '/%5cevil.test', '/login', '/auth/callback', '/%zz']) {
      expect(safeAuthRedirect(value)).toBe('/home');
    }
  });
});
