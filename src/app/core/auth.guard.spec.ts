import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, guestGuard, requiresLogin } from './auth.guard';
import { AuthService } from './auth.service';

describe('route guards', () => {
  const loggedIn = signal(false);

  beforeEach(() => {
    loggedIn.set(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { ready: Promise.resolve(), isLoggedIn: () => loggedIn() } }],
    });
  });

  // Guards are run the way the router runs them: inside an injection context
  const run = (guard: CanActivateFn, url: string) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  const url = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('sends a guest who opens a private page to the login page, remembering where they were going', async () => {
    expect(url(await run(authGuard, '/checkout'))).toBe('/login?redirect=%2Fcheckout');
  });

  it('lets a logged-in customer open a private page', async () => {
    loggedIn.set(true);
    expect(await run(authGuard, '/checkout')).toBe(true);
  });

  it('sends a logged-in customer away from the login page', async () => {
    loggedIn.set(true);
    expect(url(await run(guestGuard, '/login'))).toBe('/home');
  });

  it('lets a guest open the login page', async () => {
    expect(await run(guestGuard, '/login')).toBe(true);
  });

  it('knows which addresses need a login', () => {
    expect(requiresLogin('/checkout')).toBe(true);
    expect(requiresLogin('/orders/12')).toBe(true);
    expect(requiresLogin('/profile?x=1')).toBe(true);
    expect(requiresLogin('/shop')).toBe(false);
    expect(requiresLogin('/orders-info')).toBe(false);
  });
});
