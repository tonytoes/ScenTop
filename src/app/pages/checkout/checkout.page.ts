import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { applyServerErrors } from '../../core/forms';
import { OrderService } from '../../core/order.service';
import { PageComponent } from '../../layout/page/page.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { PesoPipe } from '../../shared/peso.pipe';
import { TextFieldComponent } from '../../shared/text-field/text-field.component';

@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, RouterLink, IonIcon, PageComponent, EmptyStateComponent, PesoPipe, TextFieldComponent],
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage {
  private readonly router = inject(Router);
  private readonly orders = inject(OrderService);
  protected readonly cartService = inject(CartService);
  private readonly auth = inject(AuthService);

  protected readonly submitting = signal(false);
  protected readonly formError = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    shipName: ['', [Validators.required, Validators.maxLength(60)]],
    shipPhone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,20}$/)]],
    shipAddress: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
    notes: ['', [Validators.maxLength(300)]],
  });

  /** Runs every time the page is shown: refreshes the cart and fills in the saved details. */
  ionViewWillEnter() {
    const user = this.auth.user();
    if (user && !this.form.dirty) {
      this.form.patchValue({
        shipName: this.form.controls.shipName.value || `${user.firstName} ${user.lastName}`.trim(),
        shipPhone: this.form.controls.shipPhone.value || user.phone,
        shipAddress: this.form.controls.shipAddress.value || user.address,
      });
    }
    void this.cartService.refresh().catch(() => undefined);
  }

  protected async placeOrder() {
    this.formError.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Please check the highlighted fields.');
      return;
    }

    this.submitting.set(true);
    try {
      const order = await this.orders.place({ ...this.form.getRawValue(), paymentMethod: 'cod' });
      await this.router.navigate(['/order-success', order.id], { replaceUrl: true });
      this.form.reset();
    } catch (error) {
      if (!applyServerErrors(this.form, error)) this.formError.set(errorMessage(error));
      else this.formError.set('Please check the highlighted fields.');
    } finally {
      this.submitting.set(false);
    }
  }
}
