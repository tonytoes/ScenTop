import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { applyServerErrors } from '../../core/forms';
import { TextFieldComponent } from '../../shared/text-field/text-field.component';

/** Marks the "confirm password" field wrong until it matches the password field. */
function matchesPassword(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  return control.value === password ? null : { message: 'Passwords do not match.' };
}

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, IonContent, TextFieldComponent],
  templateUrl: './signup.page.html',
  styleUrl: './auth.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitting = signal(false);
  protected readonly formError = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,20}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    confirmPassword: ['', [Validators.required, matchesPassword]],
  });

  constructor() {
    // When the password changes, the confirmation has to be checked again
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  protected get redirect(): string {
    const target = this.route.snapshot.queryParamMap.get('redirect') ?? '';
    return target.startsWith('/') && !target.startsWith('//') ? target : '/home';
  }

  protected get loginQuery() {
    return this.route.snapshot.queryParamMap.has('redirect') ? { redirect: this.redirect } : {};
  }

  protected async submit() {
    this.formError.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitting.set(true);
    try {
      const { firstName, lastName, email, phone, password } = this.form.getRawValue();
      await this.auth.signup({ firstName, lastName, email, phone, password });
      await this.router.navigateByUrl(this.redirect, { replaceUrl: true });
    } catch (error) {
      if (!applyServerErrors(this.form, error)) this.formError.set(errorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
