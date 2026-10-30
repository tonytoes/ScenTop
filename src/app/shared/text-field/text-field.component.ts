import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';

let nextId = 0;

/**
 * A labelled form field with its error message.
 *
 *   <app-text-field label="E-mail" type="email" [control]="form.controls.email" autocomplete="email" />
 *
 * Works with a typed FormControl<string>. Errors from the server are shown by calling
 * control.setErrors({ server: 'message' }).
 */
@Component({
  selector: 'app-text-field',
  imports: [ReactiveFormsModule, IonIcon],
  templateUrl: './text-field.component.html',
  styleUrl: './text-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextFieldComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly control = input.required<FormControl<string>>();
  readonly label = input.required<string>();
  readonly type = input<'text' | 'email' | 'tel' | 'password'>('text');
  readonly autocomplete = input('off');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly rows = input(0);
  readonly maxlength = input<number | null>(null);

  protected readonly id = `field-${nextId++}`;
  protected readonly showPassword = signal(false);
  protected readonly isPassword = computed(() => this.type() === 'password');
  protected readonly inputType = computed(() => (this.isPassword() && this.showPassword() ? 'text' : this.type()));

  // Form controls are not signals, so this counter makes the template re-check the control when it changes
  private readonly changes = signal(0);

  /** The message to show, or '' while the field is untouched or valid. */
  protected readonly error = computed(() => {
    this.changes();
    const control = this.control();
    if (!control.invalid || !(control.touched || control.dirty)) return '';

    const errors = control.errors ?? {};
    const label = this.label();
    if (typeof errors['server'] === 'string') return errors['server'];
    if (errors['required']) return `${label} is required.`;
    if (errors['email']) return 'Enter a valid e-mail address.';
    if (errors['minlength']) return `${label} must be at least ${errors['minlength'].requiredLength} characters.`;
    if (errors['maxlength']) return `${label} is too long.`;
    if (errors['pattern']) return `Enter a valid ${label.toLowerCase()}.`;
    if (typeof errors['message'] === 'string') return errors['message'];
    return `${label} is not valid.`;
  });

  ngOnInit() {
    this.control()
      .events.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.changes.update((n) => n + 1));
  }
}
