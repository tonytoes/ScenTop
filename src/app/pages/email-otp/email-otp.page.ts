import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api-error';
import { safeAuthRedirect, needsProfile } from '../../core/auth-navigation';
import { TextFieldComponent } from '../../shared/text-field/text-field.component';

@Component({
  selector: 'app-email-otp', imports: [ReactiveFormsModule, RouterLink, IonContent, TextFieldComponent],
  templateUrl: './email-otp.page.html', styleUrl: '../signup/auth.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailOtpPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly sent = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly cooldown = signal(0);
  private timer?: ReturnType<typeof setInterval>;
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    otp: ['', [Validators.required, Validators.pattern(/^[0-9]{4,10}$/)]],
  });
  constructor() { inject(DestroyRef).onDestroy(() => clearInterval(this.timer)); }
  private get target() { return safeAuthRedirect(this.route.snapshot.queryParamMap.get('redirect')); }
  protected async send() {
    if (this.busy() || this.cooldown() > 0) return;
    this.form.controls.email.markAsTouched();
    if (this.form.controls.email.invalid) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.auth.sendLoginOtp(this.form.controls.email.value);
      this.sent.set(true); this.cooldown.set(60);
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        this.cooldown.update(value => Math.max(0, value - 1));
        if (!this.cooldown()) clearInterval(this.timer);
      }, 1000);
    } catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
  protected changeEmail() {
    if (this.busy()) return;
    this.sent.set(false); this.form.controls.otp.reset(); this.error.set('');
    // Keep the resend cooldown when changing addresses.
  }
  protected async verify() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set('');
    this.auth.rememberRedirect(this.target);
    try {
      const { email, otp } = this.form.getRawValue();
      const user = await this.auth.verifyLoginOtp(email, otp);
      const target = this.auth.consumeRedirect();
      if (needsProfile(user)) await this.router.navigate(['/complete-profile'], { queryParams: { redirect: target }, replaceUrl: true });
      else await this.router.navigateByUrl(target, { replaceUrl: true });
    } catch (error) {
      if (this.auth.pendingLink()) await this.router.navigateByUrl('/auth/callback', { replaceUrl: true });
      else this.error.set(errorMessage(error));
    } finally { this.busy.set(false); }
  }
}
