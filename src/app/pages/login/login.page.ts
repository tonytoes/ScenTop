import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { applyServerErrors } from '../../core/forms';
import { PasswordlessActionsComponent } from '../../shared/passwordless-actions/passwordless-actions.component';
import { safeAuthRedirect } from '../../core/auth-navigation';
import { TextFieldComponent } from '../../shared/text-field/text-field.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, IonContent, TextFieldComponent, PasswordlessActionsComponent],
  templateUrl: './login.page.html',
  styleUrl: '../signup/auth.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitting = signal(false);
  protected readonly formError = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** Where to go after logging in. Only addresses inside the app are allowed. */
  protected get redirect(): string {
    const target = this.route.snapshot.queryParamMap.get('redirect') ?? '';
    return safeAuthRedirect(target);
  }

  protected get signupQuery() {
    return this.route.snapshot.queryParamMap.has('redirect') ? { redirect: this.redirect } : {};
  }

  protected async submit() {
    this.formError.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitting.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      await this.router.navigateByUrl(this.redirect, { replaceUrl: true });
    } catch (error) {
      if (!applyServerErrors(this.form, error)) this.formError.set(errorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
