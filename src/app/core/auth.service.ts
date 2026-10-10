import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
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
    try {
      const { user } = await firstValueFrom(this.http.get<{ user: User }>(`${this.api}/me`));
      await this.setUser(user);
    } catch {
      // Offline or the server is down: keep the saved login. The interceptor handles expired tokens.
    }
  }
}
