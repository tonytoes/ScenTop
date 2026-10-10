import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertController, IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { applyServerErrors } from '../../core/forms';
import { ToastService } from '../../core/toast.service';
import { PageComponent } from '../../layout/page/page.component';
import { resizeToSquareDataUrl } from '../../shared/resize-image';
import { TextFieldComponent } from '../../shared/text-field/text-field.component';

function matchesNewPassword(control: AbstractControl): ValidationErrors | null {
  return control.value === control.parent?.get('newPassword')?.value ? null : { message: 'Passwords do not match.' };
}

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink, IonIcon, PageComponent, TextFieldComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertController);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly saving = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly formError = signal('');
  protected readonly passwordError = signal('');
  protected readonly photoError = signal('');

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '';
  });

  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,20}$/)]],
    address: ['', [Validators.maxLength(300)]],
  });

  protected readonly passwordForm = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    confirmPassword: ['', [Validators.required, matchesNewPassword]],
  });

  constructor() {
    // Fill the form with the saved details, unless the person is in the middle of editing them
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      untracked(() => {
        if (this.form.pristine) this.form.reset({ firstName: user.firstName, lastName: user.lastName, phone: user.phone, address: user.address });
      });
    });

    this.passwordForm.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.passwordForm.controls.confirmPassword.updateValueAndValidity());
  }

  protected async saveProfile() {
    this.formError.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    try {
      await this.auth.updateProfile(this.form.getRawValue());
      this.form.markAsPristine();
      await this.toast.show('Profile saved', { icon: 'checkmark-circle' });
    } catch (error) {
      if (!applyServerErrors(this.form, error)) this.formError.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async changePhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.photoError.set('');
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('too large');
      await this.auth.updateProfile({ photoUrl: await resizeToSquareDataUrl(file) });
      await this.toast.show('Profile picture updated');
    } catch (error) {
      this.photoError.set(error instanceof Error && error.message === 'too large' ? 'Please choose a picture under 15 MB.' : 'We could not use that picture. Try a PNG or JPG.');
    }
  }

  protected async removePhoto() {
    try {
      await this.auth.updateProfile({ photoUrl: null });
    } catch (error) {
      this.photoError.set(errorMessage(error));
    }
  }

  protected async changePassword() {
    this.passwordError.set('');
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;

    this.savingPassword.set(true);
    try {
      const { currentPassword, newPassword } = this.passwordForm.getRawValue();
      await this.auth.changePassword(currentPassword, newPassword);
      this.passwordForm.reset();
      await this.toast.show('Password changed', { icon: 'checkmark-circle' });
    } catch (error) {
      if (!applyServerErrors(this.passwordForm, error)) this.passwordError.set(errorMessage(error));
    } finally {
      this.savingPassword.set(false);
    }
  }

  protected async logout() {
    await this.auth.logout();
    await this.router.navigate(['/home'], { replaceUrl: true });
  }

  protected async confirmDelete() {
    const alert = await this.alerts.create({
      header: 'Delete your account?',
      message: 'This permanently deletes your profile, cart, wishlist and reviews. Enter your password to confirm.',
      inputs: [{ name: 'password', type: 'password', placeholder: 'Your password', attributes: { autocomplete: 'current-password' } }],
      buttons: [
        { text: 'Keep my account', role: 'cancel' },
        { text: 'Delete forever', role: 'confirm', cssClass: 'st-danger' },
      ],
    });
    await alert.present();

    const { role, data } = await alert.onDidDismiss<{ values?: { password?: string } }>();
    if (role !== 'confirm') return;

    try {
      await this.auth.deleteAccount(data?.values?.password ?? '');
      await this.router.navigate(['/home'], { replaceUrl: true });
      await this.toast.show('Your account was deleted');
    } catch (error) {
      await this.toast.show(errorMessage(error));
    }
  }
}
