import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { CartItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { PageComponent } from '../../layout/page/page.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { PesoPipe } from '../../shared/peso.pipe';
import { QuantityStepperComponent } from '../../shared/quantity-stepper/quantity-stepper.component';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, IonIcon, PageComponent, EmptyStateComponent, PesoPipe, QuantityStepperComponent],
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly cartService = inject(CartService);
  protected readonly auth = inject(AuthService);

  /** The variant being changed right now, so its row can show it is busy. */
  protected readonly busyId = signal<number | null>(null);

  protected readonly reload = () => this.cartService.refresh();

  ionViewWillEnter() {
    void this.cartService.refresh().catch((error) => this.toast.show(errorMessage(error)));
  }

  protected async setQuantity(item: CartItem, quantity: number) {
    if (quantity === item.quantity) return;
    await this.change(item, () => this.cartService.setQuantity(item.variantId, quantity));
  }

  protected async remove(item: CartItem) {
    await this.change(item, () => this.cartService.remove(item.variantId));
    await this.toast.show(`${item.name} removed from your cart`);
  }

  protected checkout() {
    // Guests are asked to log in, then brought straight back to checkout
    void this.router.navigate([this.auth.isLoggedIn() ? '/checkout' : '/login'], this.auth.isLoggedIn() ? {} : { queryParams: { redirect: '/checkout' } });
  }

  private async change(item: CartItem, action: () => Promise<void>) {
    this.busyId.set(item.variantId);
    try {
      await action();
    } catch (error) {
      await this.toast.show(errorMessage(error));
    } finally {
      this.busyId.set(null);
    }
  }
}
