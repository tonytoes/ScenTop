import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../../core/api';
import { AdminAuth } from '../../core/auth';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <section class="art" aria-hidden="true">
      <svg viewBox="0 0 400 400" class="rings">
        @for (r of [60, 100, 140, 180]; track r) {
          <circle cx="200" cy="200" [attr.r]="r" />
        }
        <path d="M200 20 A180 180 0 0 1 380 200" class="arc" />
        <path d="M200 100 A100 100 0 0 1 286.6 250" class="arc arc-2" />
      </svg>
      <div class="copy">
        <span class="eyebrow">ScenTop</span>
        <h1 class="display">The studio<br />behind the scent.</h1>
        <p>Orders, perfumes, customers and the numbers that tie them together.</p>
      </div>
    </section>

    <section class="form-side">
      <form (ngSubmit)="submit()" #form="ngForm">
        <h2 class="display">Admin log in</h2>
        <p class="muted">Use an account that has admin access.</p>

        @if (error()) {
          <div class="alert" role="alert">{{ error() }}</div>
        }

        <label class="field">
          <span>E-mail</span>
          <input class="input" type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
        </label>
        <label class="field">
          <span>Password</span>
          <input class="input" type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" />
        </label>

        <button class="btn btn-primary" type="submit" [disabled]="busy() || !form.valid">
          {{ busy() ? 'Checking…' : 'Enter the studio' }}
        </button>
        <small class="muted hint">First run on your computer? The starter admin login is in <code>.env.example</code>.</small>
      </form>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      min-height: 100vh;
      @media (max-width: 860px) {
        grid-template-columns: 1fr;
      }
    }
    .art {
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at 80% 10%, #5a2a40, transparent 55%), var(--hero);
      color: var(--hero-ink);
      display: flex;
      align-items: flex-end;
      padding: 56px;
      @media (max-width: 860px) {
        min-height: 260px;
        padding: 28px;
      }
    }
    .rings {
      position: absolute;
      right: -120px;
      top: -80px;
      width: 640px;
      max-width: 120%;
      circle {
        fill: none;
        stroke: rgba(255, 255, 255, 0.09);
      }
      .arc {
        fill: none;
        stroke: #e8798f;
        stroke-width: 3;
        stroke-linecap: round;
      }
      .arc-2 {
        stroke: #d9ad4c;
      }
    }
    .copy {
      position: relative;
      h1 {
        font-size: clamp(44px, 6vw, 76px);
        margin: 12px 0 16px;
      }
      p {
        color: var(--hero-muted);
        max-width: 360px;
        margin: 0;
      }
      .eyebrow {
        color: #e8798f;
      }
    }
    .form-side {
      display: grid;
      place-items: center;
      padding: 32px 16px;
    }
    form {
      width: min(380px, 100%);
      display: grid;
      gap: 16px;
      h2 {
        font-size: 40px;
      }
      p {
        margin: -10px 0 4px;
      }
      .btn {
        height: 46px;
        margin-top: 6px;
      }
    }
    .hint {
      font-size: 12px;
      code {
        background: var(--surface-3);
        padding: 1px 6px;
        border-radius: 6px;
      }
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigate(['/']);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
