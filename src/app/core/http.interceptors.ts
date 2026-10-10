import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';
import { requiresLogin } from './auth.guard';
import { AuthService } from './auth.service';
import { TokenStore } from './token-store';

/** Sends the login token with every call to our own API. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(TokenStore).token();
  if (!token || !request.url.startsWith(environment.apiUrl)) return next(request);
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/** Turns every failed call into an ApiError, and logs the user out when their token has expired. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const injector = inject(Injector);
  const hadToken = inject(TokenStore).token() !== null;

  return next(request).pipe(
    catchError((response: HttpErrorResponse) => {
      const body = response.error?.error;

      // No answer at all (0), or an error page that did not come from our API (e.g. the dev proxy when the API is not running)
      if (response.status === 0 || (response.status >= 500 && typeof body?.message !== 'string')) {
        console.error(`[ScenTop] The API did not answer ${request.method} ${request.url} (status ${response.status}). Running locally? Make sure "npm start" is running and check its terminal for [api] errors.`);
        return throwError(() => new ApiError('We could not reach the server. Check your connection and try again.', 0));
      }

      const message = typeof body?.message === 'string' ? body.message : 'Something went wrong. Please try again.';

      // A 401 on a call that carried a token means the login expired (wrong passwords at the login form have no token)
      if (response.status === 401 && hadToken) void signOutExpiredSession(injector);

      return throwError(() => new ApiError(message, response.status, body?.code, body?.fields ?? {}));
    }),
  );
};

async function signOutExpiredSession(injector: Injector) {
  await injector.get(AuthService).logout();

  const router = injector.get(Router);
  if (requiresLogin(router.url)) await router.navigate(['/login'], { queryParams: { redirect: router.url } });
}
