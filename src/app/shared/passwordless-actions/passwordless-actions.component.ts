import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api-error';

@Component({
  selector: 'app-passwordless-actions',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.passwordlessEnabled) {
      <div class="stack" style="margin-top: 24px; --gap: 12px">
        <p class="muted">Or continue without a ScenTop password</p>
        @if (auth.googleEnabled) {
          <button type="button" class="btn btn--dark btn--block" [disabled]="busy()" (click)="google()">
            {{ busy() ? 'Opening Google…' : 'Continue with Google' }}
          </button>
        }
        <a class="btn btn--soft btn--block" routerLink="/email-otp" [queryParams]="{redirect: redirect()}">Continue with an email code</a>
        <p class="muted">New here? Continuing creates an account. By continuing, you agree to our
          <a routerLink="/terms">terms</a> and <a routerLink="/privacy">privacy policy</a>.</p>
        @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
      </div>
    }
  `,
})
export class PasswordlessActionsComponent {
  protected readonly auth = inject(AuthService);
  readonly redirect = input('/home');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected async google() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try { await this.auth.loginWithGoogle(this.redirect()); }
    catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
