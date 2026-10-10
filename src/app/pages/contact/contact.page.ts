import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { COMPANY } from '../../core/company';
import { ContactService } from '../../core/contact.service';
import { applyServerErrors } from '../../core/forms';
import { PageComponent } from '../../layout/page/page.component';
import { TextFieldComponent } from '../../shared/text-field/text-field.component';

@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, IonIcon, PageComponent, TextFieldComponent],
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPage {
  private readonly contact = inject(ContactService);
  private readonly auth = inject(AuthService);

  protected readonly company = COMPANY;
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly formError = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  constructor() {
    // Logged-in customers do not need to type their name and e-mail again
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      untracked(() => {
        if (this.form.pristine) this.form.patchValue({ name: `${user.firstName} ${user.lastName}`.trim(), email: user.email });
      });
    });
  }

  protected async send() {
    this.formError.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.sending.set(true);
    try {
      await this.contact.send(this.form.getRawValue());
      this.sent.set(true);
      this.form.controls.message.reset();
    } catch (error) {
      if (!applyServerErrors(this.form, error)) this.formError.set(errorMessage(error));
    } finally {
      this.sending.set(false);
    }
  }
}
