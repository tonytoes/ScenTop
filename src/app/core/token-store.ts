import { Injectable, signal } from '@angular/core';

/**
 * Holds the login token for the HTTP interceptor. It is separate from AuthService
 * because AuthService itself makes HTTP calls, and the interceptor must not depend on it.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  readonly token = signal<string | null>(null);
}
