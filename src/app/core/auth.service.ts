import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ApiError } from './api-error';
import { safeAuthRedirect } from './auth-navigation';
import { ToastService } from './toast.service';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from './models';
import { StorageService } from './storage.service';
import { TokenStore } from './token-store';

interface Session {
  token: string;
  user: User;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  readonly passwordlessEnabled = Boolean(environment.neonAuthUrl);
  readonly googleEnabled = this.passwordlessEnabled && !Capacitor.isNativePlatform();
  readonly pendingLink = signal<string | null>(null);

  private async neon() {
    return (await import('./neon-auth.client')).getNeonAuth();
  }

  rememberRedirect(target: string): void {
    sessionStorage.setItem('scentop.auth.redirect', safeAuthRedirect(target));
  }

  consumeRedirect(): string {
    const target = safeAuthRedirect(sessionStorage.getItem('scentop.auth.redirect'));
    sessionStorage.removeItem('scentop.auth.redirect');
    return target;
  }

  async loginWithGoogle(target = '/home'): Promise<void> {
    if (!this.googleEnabled) throw new ApiError('Google sign-in is currently available on the website only.', 400);
    this.pendingLink.set(null);
    this.rememberRedirect(target);
    try {
      const { error } = await (await this.neon()).signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/auth/callback`,
        errorCallbackURL: `${window.location.origin}/auth/callback?failed=1`,
      });
      if (error) throw new Error('provider_error');
    } catch {
      throw new ApiError('Google sign-in could not start. Please try again.', 400);
    }
  }

async completeGoogleLogin(): Promise<User> {
  let proof: string | null = null;

  try {
    const client = await this.neon();

    const session = await client.getSession({
      fetchOptions: {
        credentials: 'include',
        headers: {
          'X-Force-Fetch': 'true',
        },

        onSuccess: (ctx) => {
          proof = ctx.response.headers.get('set-auth-jwt');
        },
      },
    });

    if (session.error || !proof) {
      throw new Error('missing_session_token');
    }
  } catch {
    throw new ApiError(
      'The Google session could not be restored. Please start sign-in again.',
      400,
    );
  }

  return this.acceptPasswordless('/neon/exchange', {
    neonToken: proof,
  });
}

  async sendLoginOtp(email: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/otp/send`, { email: email.trim() }));
  }

  async verifyLoginOtp(email: string, otp: string): Promise<User> {
    this.pendingLink.set(null);
    return this.acceptPasswordless('/otp/verify', { email: email.trim(), otp: otp.trim() });
  }

  async linkNeonAccount(password: string): Promise<User> {
    const linkTicket = this.pendingLink();
    if (!linkTicket) throw new ApiError('Start Google or email sign-in again before linking.', 400);
    return this.acceptPasswordless('/neon/link', { linkTicket, password });
  }


private async acceptPasswordless(path: string, body: unknown): Promise<User> {
  try {
    const session = await firstValueFrom(
      this.http.post<Session>(
        `${this.api}${path}`,
        body,
        { withCredentials: true }
      )
    );

    this.pendingLink.set(null);
    await this.startSession(session);
    return session.user;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'account_link_required') {
      this.pendingLink.set(error.fields['linkTicket'] ?? null);
    }
    throw error;
  }
}


  async sendDeleteCode(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/delete-code`, {}));
  }

  async deletePasswordlessAccount(otp: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.api}/me`, { body: { otp } }));
    await this.logout();
  }

  private readonly storage = inject(StorageService);
  private readonly tokens = inject(TokenStore);

  private readonly api = `${environment.apiUrl}/auth`;

  /** The logged-in user, or null for a guest. */
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly displayName = computed(() => {
    const user = this.user();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Guest';
  });

  /** Resolves once a saved login has been restored. Guards wait for this. */
  readonly ready: Promise<void> = this.restore();

  async login(email: string, password: string): Promise<User> {
    const session = await firstValueFrom(this.http.post<Session>(`${this.api}/login`, { email, password }));
    await this.startSession(session);
    return session.user;
  }

  async signup(details: { firstName: string; lastName: string; email: string; phone: string; password: string }): Promise<User> {
    const session = await firstValueFrom(this.http.post<Session>(`${this.api}/signup`, details));
    await this.startSession(session);
    return session.user;
  }

  async logout(): Promise<void> {
    this.tokens.token.set(null);
    this.user.set(null);
    await Promise.all([this.storage.remove(TOKEN_KEY), this.storage.remove(USER_KEY)]);
    this.pendingLink.set(null);
    sessionStorage.removeItem('scentop.auth.redirect');
    if (this.googleEnabled) {
      try {
        const { error } = await (await this.neon()).signOut();
        if (error) throw new Error('signout_failed');
      } catch {
        await this.injector.get(ToastService).show('ScenTop is logged out, but Google sign-in cleanup failed. On a shared device, close the browser or clear its site data.', { duration: 8000 });
      }
    }
  }

  async updateProfile(changes: Partial<Pick<User, 'firstName' | 'lastName' | 'phone' | 'address' | 'photoUrl'>>): Promise<User> {
    const { user } = await firstValueFrom(this.http.patch<{ user: User }>(`${this.api}/me`, changes));
    await this.setUser(user);
    return user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.api}/change-password`, { currentPassword, newPassword }));
  }

  async deleteAccount(password: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.api}/me`, { body: { password } }));
    await this.logout();
  }

  private async startSession(session: Session) {
    this.pendingLink.set(null);
    this.tokens.token.set(session.token);
    await this.storage.set(TOKEN_KEY, session.token);
    await this.setUser(session.user);
  }

  private async setUser(user: User) {
    this.user.set(user);
    await this.storage.set(USER_KEY, user);
  }

  /** Restores the saved login instantly, then checks with the server in the background. */
  private async restore(): Promise<void> {
    const [token, user] = await Promise.all([this.storage.get<string>(TOKEN_KEY), this.storage.get<User>(USER_KEY)]);
    if (!token) return;

    this.tokens.token.set(token);
    this.user.set(user);
    void this.refreshProfile();
  }

  private async refreshProfile() {
    const requestedToken = this.tokens.token();
    try {
      const { user } = await firstValueFrom(this.http.get<{ user: User }>(`${this.api}/me`));
      if (this.tokens.token() === requestedToken) await this.setUser(user);
    } catch {
      // Offline or the server is down: keep the saved login. The interceptor handles expired tokens.
    }
  }
}
