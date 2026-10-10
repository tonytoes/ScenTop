import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { CartService } from '../../core/cart.service';
import { ProductSummary } from '../../core/models';
import { NativeService } from '../../core/native.service';
import { ToastService } from '../../core/toast.service';
import { WishlistService } from '../../core/wishlist.service';
import { PesoPipe } from '../peso.pipe';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, IonIcon, PesoPipe, RatingStarsComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCardComponent {
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly toast = inject(ToastService);
  private readonly native = inject(NativeService);

  readonly product = input.required<ProductSummary>();

  protected readonly saved = computed(() => this.wishlist.has(this.product().id));

  protected async toggleSaved() {
    const product = this.product();
    try {
      const nowSaved = await this.wishlist.toggle(product.id);
      await this.toast.show(nowSaved ? `${product.name} saved to your wishlist` : `${product.name} removed from your wishlist`);
    } catch (error) {
      await this.toast.show(errorMessage(error));
    }
  }

  /** Adds the smallest bottle. Other sizes are chosen on the product page. */
  protected async quickAdd() {
    const product = this.product();
    const variant = product.variants[0];
    if (!variant) return;

    try {
      await this.cart.add(variant.id);
      await this.native.tap();
      await this.toast.show(`${product.name} (${variant.sizeMl} ml) added to your cart`, { icon: 'checkmark-circle' });
    } catch (error) {
      await this.toast.show(errorMessage(error));
    }
  }
}
