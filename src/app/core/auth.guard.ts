import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

const LOGIN_REQUIRED = ['/checkout', '/orders', '/profile', '/order-success'];

/** True for pages that only make sense when logged in. */
export const requiresLogin = (url: string) => LOGIN_REQUIRED.some((prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`));

/** Pages that need a login. Sends guests to the login page and brings them back afterwards. */
export const authGuard: CanActivateFn = async (_route, state) => {
  // inject() only works before the first await
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.isLoggedIn() || router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** Login and sign-up pages make no sense for someone who is already logged in. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return !auth.isLoggedIn() || router.createUrlTree(['/home']);
};
