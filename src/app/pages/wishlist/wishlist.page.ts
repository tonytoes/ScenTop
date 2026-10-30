import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../core/wishlist.service';
import { PageComponent } from '../../layout/page/page.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, PageComponent, EmptyStateComponent, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page [refresh]="reload">
      <header class="page-head">
        <div class="container">
          <span class="eyebrow">Saved for later</span>
          <h1>Your wishlist</h1>
          <p>Tap the heart on any perfume to keep it here.</p>
        </div>
      </header>

      <section class="container section">
        @if (wishlist.loading() && wishlist.items().length === 0) {
          <div class="product-grid">
            @for (item of [1, 2, 3, 4]; track item) {
              <div class="skeleton" style="aspect-ratio: 0.72"></div>
            }
          </div>
        } @else if (wishlist.items().length === 0) {
          <app-empty-state icon="heart-outline" heading="Your wishlist is empty" text="Tap the heart on a perfume you love and it will wait for you here.">
            <a class="btn btn--primary" routerLink="/shop">Browse perfumes</a>
          </app-empty-state>
        } @else {
          <div class="product-grid">
            @for (product of wishlist.items(); track product.id) {
              <app-product-card [product]="product" />
            }
          </div>
        }
      </section>
    </app-page>
  `,
})
export class WishlistPage {
  protected readonly wishlist = inject(WishlistService);

  protected readonly reload = () => this.wishlist.refresh();

  /** Ionic calls this every time the page is shown, so the list is always up to date. */
  ionViewWillEnter() {
    void this.reload();
  }
}
