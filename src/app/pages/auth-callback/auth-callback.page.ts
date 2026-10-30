import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api-error';
import { needsProfile } from '../../core/auth-navigation';
import { User } from '../../core/models';
import { TextFieldComponent } from '../../shared/text-field/text-field.component';

@Component({
  selector: 'app-auth-callback', imports: [ReactiveFormsModule, RouterLink, IonContent, TextFieldComponent],
  template: `<ion-content><main class="auth"><section class="auth__panel">
    <h1>{{ auth.pendingLink() ? 'Link your existing account' : 'Completing sign-in' }}</h1>
    @if (busy()) { <p role="status">Please wait…</p> }
    @if (auth.pendingLink()) {
      <p>This email already has a ScenTop account. Confirm its password to keep your existing orders, cart and wishlist.</p>
      <form [formGroup]="form" (ngSubmit)="link()" class="stack">
        <app-text-field label="Existing ScenTop password" type="password" autocomplete="current-password" [control]="form.controls.password" />
        <button type="submit" class="btn btn--primary" [disabled]="busy()">Confirm and link account</button>
      </form>
    }
    @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
    <a routerLink="/login">Back to login</a>
  </section></main></ion-content>`,
  styleUrl: '../signup/auth.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(NonNullableFormBuilder).group({ password: ['', [Validators.required, Validators.maxLength(72)]] });
  async ngOnInit() {
    await this.auth.ready;
    if (this.auth.pendingLink()) return;
    if (this.route.snapshot.queryParamMap.has('failed')) { this.error.set('Google sign-in was cancelled or failed. Please try again.'); return; }
    this.busy.set(true);
    try { await this.finish(await this.auth.completeGoogleLogin()); }
    catch (error) { if (!this.auth.pendingLink()) this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
  protected async link() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set('');
    try { await this.finish(await this.auth.linkNeonAccount(this.form.controls.password.value)); }
    catch (error) { this.error.set(errorMessage(error)); }
    finally { this.form.reset(); this.busy.set(false); }
  }
  private async finish(user: User) {
    const target = this.auth.consumeRedirect();
    if (needsProfile(user)) await this.router.navigate(['/complete-profile'], { queryParams: { redirect: target }, replaceUrl: true });
    else await this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
