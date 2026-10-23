import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { ApiError, toApiError } from './api';
import type { User } from './models';

// Separate from the shop's saved login, so the admin app never logs you in or out of the shop
const TOKEN_KEY = 'scentop-admin-token';

/**
 * Holds the login token for the interceptor. Separate from AdminAuth because AdminAuth
 * makes HTTP calls while it starts up, and the interceptor must not depend on it.
 */
@Injectable({ providedIn: 'root' })
export class AdminToken {
  readonly value = signal<string | null>(read(TOKEN_KEY));
}

@Injectable({ providedIn: 'root' })
export class AdminAuth {
  private readonly http = inject(HttpClient);

  readonly token = inject(AdminToken).value;
  readonly user = signal<User | null>(null);
  readonly name = computed(() => {
    const user = this.user();
    return user ? `${user.firstName} ${user.lastName}` : '';
  });

  /** Resolves once a saved login has been checked with the server. */
  readonly ready: Promise<void> = this.restore();

  async login(email: string, password: string): Promise<void> {
    let session: { token: string; user: User };
    try {
      session = await firstValueFrom(this.http.post<{ token: string; user: User }>('/api/auth/login', { email, password }));
    } catch (error) {
      throw toApiError(error);
    }
    if (session.user.role !== 'admin') throw new ApiError('This account is not a shop admin.', 403);
    this.token.set(session.token);
    this.user.set(session.user);
    write(TOKEN_KEY, session.token);
  }

  logout(): void {
    this.token.set(null);
    this.user.set(null);
    write(TOKEN_KEY, null);
  }

  private async restore(): Promise<void> {
    if (!this.token()) return;
    try {
      const { user } = await firstValueFrom(this.http.get<{ user: User }>('/api/auth/me'));
      if (user.role === 'admin') this.user.set(user);
      else this.logout();
    } catch (error) {
      // Only forget the login when the server rejects it, not when the API is still starting up
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) this.logout();
    }
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the login simply lasts until the tab is closed
  }
}

/** Adds the admin's token to API calls, and goes back to the login page when it stops working. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const injector = inject(Injector);
  const token = inject(AdminToken).value();
  const authed = token && request.url.startsWith('/api') ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(authed).pipe(
    catchError((error) => {
      if (token && error.status === 401 && !request.url.endsWith('/auth/login')) {
        injector.get(AdminAuth).logout();
        void injector.get(Router).navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};

export const adminGuard: CanActivateFn = () => (inject(AdminAuth).user() ? true : inject(Router).createUrlTree(['/login']));
export const loginGuard: CanActivateFn = () => (inject(AdminAuth).user() ? inject(Router).createUrlTree(['/']) : true);
