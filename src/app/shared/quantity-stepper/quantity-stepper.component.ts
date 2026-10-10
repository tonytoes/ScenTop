import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/**
 * A - 1 + control. The page owns the number: pass it in with [value] and update it in (valueChange).
 * (If a change fails, the page simply keeps the old number and the stepper shows it again.)
 */
@Component({
  selector: 'app-quantity-stepper',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: inline-block; }
    .stepper {
      display: inline-flex; align-items: center; gap: 4px; padding: 4px;
      border: 1.5px solid var(--st-line); border-radius: 999px; background: #fff;
    }
    button {
      display: grid; place-items: center; width: 36px; height: 36px; padding: 0;
      border: 0; border-radius: 50%; background: var(--st-blush); color: var(--st-rose-dark);
      font-size: 18px; cursor: pointer; transition: background-color 0.2s ease, transform 0.15s ease;
    }
    button:hover:not(:disabled) { background: var(--st-blush-deep); }
    button:active:not(:disabled) { transform: scale(0.9); }
    button:disabled { opacity: 0.4; cursor: default; }
    output { min-width: 34px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
    .small button { width: 30px; height: 30px; font-size: 16px; }
    .small output { min-width: 28px; font-size: 14px; }
  `,
  template: `
    <div class="stepper" [class.small]="small()" role="group" [attr.aria-label]="label()">
      <button type="button" (click)="valueChange.emit(value() - 1)" [disabled]="value() <= min()" aria-label="Decrease quantity">
        <ion-icon name="remove-outline" />
      </button>
      <output aria-live="polite">{{ value() }}</output>
      <button type="button" (click)="valueChange.emit(value() + 1)" [disabled]="value() >= max()" aria-label="Increase quantity">
        <ion-icon name="add-outline" />
      </button>
    </div>
  `,
})
export class QuantityStepperComponent {
  readonly value = input(1);
  readonly valueChange = output<number>();
  readonly min = input(1);
  readonly max = input(99);
  readonly small = input(false, { transform: booleanAttribute });
  readonly label = input('Quantity');
}
