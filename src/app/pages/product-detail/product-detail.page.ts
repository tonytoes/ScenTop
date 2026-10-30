import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { ApiError, errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { ProductDetail, ProductSummary, Review } from '../../core/models';
import { NativeService } from '../../core/native.service';
import { ProductService } from '../../core/product.service';
import { ToastService } from '../../core/toast.service';
import { WishlistService } from '../../core/wishlist.service';
import { PageComponent } from '../../layout/page/page.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { PesoPipe } from '../../shared/peso.pipe';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { QuantityStepperComponent } from '../../shared/quantity-stepper/quantity-stepper.component';
import { RatingStarsComponent } from '../../shared/rating-stars/rating-stars.component';

const AUDIENCE_LABEL = { women: 'Women', men: 'Men', unisex: 'Everyone' } as const;

@Component({
  selector: 'app-product-detail',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    IonIcon,
    PageComponent,
    EmptyStateComponent,
    PesoPipe,
    ProductCardComponent,
    QuantityStepperComponent,
    RatingStarsComponent,
  ],
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailPage {
  private readonly products = inject(ProductService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly native = inject(NativeService);
  private readonly title = inject(Title);
  protected readonly auth = inject(AuthService);
  protected readonly wishlist = inject(WishlistService);

  /** From the address: /product/:slug */
  readonly slug = input.required<string>();

  protected readonly product = signal<ProductDetail | null>(null);
  protected readonly reviews = signal<Review[]>([]);
  protected readonly related = signal<ProductSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly error = signal('');

  protected readonly selectedVariantId = signal<number | null>(null);
  protected readonly quantity = signal(1);
  protected readonly adding = signal(false);

  protected readonly selectedVariant = computed(() => {
    const product = this.product();
    return product?.variants.find((variant) => variant.id === this.selectedVariantId()) ?? product?.variants[0] ?? null;
  });
  protected readonly totalCents = computed(() => (this.selectedVariant()?.priceCents ?? 0) * this.quantity());
  protected readonly saved = computed(() => {
    const product = this.product();
    return product ? this.wishlist.has(product.id) : false;
  });
  protected readonly audience = computed(() => AUDIENCE_LABEL[this.product()?.audience ?? 'unisex']);

  // Review form
  protected readonly newRating = signal(0);
  protected readonly reviewText = new FormControl('', { nonNullable: true });
  protected readonly reviewError = signal('');
  protected readonly postingReview = signal(false);

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => void this.load(slug));
    });
  }

  protected selectVariant(id: number) {
    this.selectedVariantId.set(id);
  }

  protected async addToCart() {
    const product = this.product();
    const variant = this.selectedVariant();
    if (!product || !variant) return;

    this.adding.set(true);
    try {
      await this.cart.add(variant.id, this.quantity());
      void this.native.tap();
      void this.toast.show(`${this.quantity()} × ${product.name} (${variant.sizeMl} ml) added to your cart`, { icon: 'checkmark-circle' });
      this.quantity.set(1);
    } catch (error) {
      void this.toast.show(errorMessage(error));
    } finally {
      this.adding.set(false);
    }
  }

  protected async toggleSaved() {
    const product = this.product();
    if (!product) return;
    try {
      const nowSaved = await this.wishlist.toggle(product.id);
      await this.toast.show(nowSaved ? 'Saved to your wishlist' : 'Removed from your wishlist');
    } catch (error) {
      await this.toast.show(errorMessage(error));
    }
  }

  protected share() {
    const product = this.product();
    if (product) void this.native.share(product.name, `/product/${product.slug}`);
  }

  protected async submitReview() {
    const product = this.product();
    if (!product) return;
    if (this.newRating() === 0) {
      this.reviewError.set('Please choose a star rating.');
      return;
    }

    this.postingReview.set(true);
    this.reviewError.set('');
    try {
      const updated = await this.products.addReview(product.slug, { rating: this.newRating(), comment: this.reviewText.value });
      this.product.set(updated);
      this.reviews.set(await this.products.reviews(product.slug));
      this.newRating.set(0);
      this.reviewText.reset();
      void this.toast.show('Thank you for your review');
    } catch (error) {
      this.reviewError.set(error instanceof ApiError ? (error.fields['rating'] ?? error.message) : errorMessage(error));
    } finally {
      this.postingReview.set(false);
    }
  }

  protected readonly reload = () => this.load(this.slug());

  private async load(slug: string) {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.quantity.set(1);
    try {
      const product = await this.products.get(slug);
      this.product.set(product);
      this.selectedVariantId.set(product.variants[0]?.id ?? null);
      this.title.setTitle(`${product.name} | ScenTop`);

      const [reviews, related] = await Promise.all([
        this.products.reviews(slug),
        this.products.list({ category: product.category, limit: 5 }),
      ]);
      this.reviews.set(reviews);
      this.related.set(related.items.filter((item) => item.id !== product.id).slice(0, 4));
    } catch (error) {
      this.product.set(null);
      if (error instanceof ApiError && error.status === 404) this.notFound.set(true);
      else this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
