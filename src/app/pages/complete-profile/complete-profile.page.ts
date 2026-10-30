import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api-error';
import { safeAuthRedirect } from '../../core/auth-navigation';
import { TextFieldComponent } from '../../shared/text-field/text-field.component';

@Component({
  selector: 'app-complete-profile', imports: [ReactiveFormsModule, RouterLink, IonContent, TextFieldComponent],
  template: `<ion-content><main class="auth"><section class="auth__panel">
    <h1>Complete your profile</h1><p>We need your name and phone number for your orders.</p>
    <form [formGroup]="form" (ngSubmit)="save()" class="stack" novalidate>
      <app-text-field label="First name" autocomplete="given-name" [control]="form.controls.firstName" />
      <app-text-field label="Last name" autocomplete="family-name" [control]="form.controls.lastName" />
      <app-text-field label="Phone number" type="tel" autocomplete="tel" [control]="form.controls.phone" />
      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
      <button type="submit" class="btn btn--primary" [disabled]="busy()">Save and continue</button>
    </form><a routerLink="/profile">Account settings</a>
  </section></main></ion-content>`,
  styleUrl: '../signup/auth.scss', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompleteProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: [this.auth.user()?.firstName ?? '', [Validators.required, Validators.maxLength(60)]],
    lastName: [this.auth.user()?.lastName ?? '', [Validators.required, Validators.maxLength(60)]],
    phone: [this.auth.user()?.phone ?? '', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,20}$/)]],
  });
  protected async save() {
    if (this.busy()) return;
    this.form.markAllAsTouched(); if (this.form.invalid) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.auth.updateProfile(this.form.getRawValue());
      await this.router.navigateByUrl(safeAuthRedirect(this.route.snapshot.queryParamMap.get('redirect')), { replaceUrl: true });
    } catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
