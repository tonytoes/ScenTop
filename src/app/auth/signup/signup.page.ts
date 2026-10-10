import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonSpinner,
} from '@ionic/angular';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';

function matchingPasswords(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  imports: [
    IonButton,
    IonContent,
    IonInput,
    IonItem,
    IonSpinner,
    ReactiveFormsModule,
    RouterLink,
  ],
})
export class SignupPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.formBuilder.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(60)]],
      lastName: ['', [Validators.required, Validators.maxLength(60)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    {
      validators: matchingPasswords,
    },
  );

  loading = false;
  errorMessage = '';

  submit(): void {
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();

      this.errorMessage = this.form.hasError('passwordMismatch')
        ? 'Passwords do not match.'
        : 'Complete all fields and use a valid email and 8-character password.';

      return;
    }

    this.loading = true;

    const { firstName, lastName, email, password } = this.form.getRawValue();

    this.auth
      .register({
        firstName,
        lastName,
        email,
        password,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.router.navigateByUrl('/home', {
            replaceUrl: true,
          });
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage =
            error.error?.message ??
            'Could not create the account. Please try again.';
        },
      });
  }

  googleSignUp(): void {
    this.errorMessage =
      'Google sign-up needs a Google OAuth client ID before it can be enabled.';
  }
}
