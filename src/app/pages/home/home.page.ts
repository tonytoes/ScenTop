import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { errorMessage } from '../../core/api-error';
import { Category, ProductSummary } from '../../core/models';
import { ProductService } from '../../core/product.service';
import { PageComponent } from '../../layout/page/page.component';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { HeroCarouselComponent } from './hero-carousel.component';

interface CategoryTile {
  name: Category;
  icon: string;
  blurb: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, IonIcon, PageComponent, ProductCardComponent, HeroCarouselComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly products = inject(ProductService);

  protected readonly bestSellers = signal<ProductSummary[]>([]);
  protected readonly newArrivals = signal<ProductSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly categories: CategoryTile[] = [
    { name: 'Floral', icon: 'flower-outline', blurb: 'Soft and romantic' },
    { name: 'Refreshing', icon: 'water-outline', blurb: 'Clean and airy' },
    { name: 'Gourmand', icon: 'cafe-outline', blurb: 'Warm and sweet' },
    { name: 'Signature', icon: 'diamond-outline', blurb: 'Bold and memorable' },
    { name: 'Verdant', icon: 'leaf-outline', blurb: 'Green and earthy' },
  ];

  ngOnInit() {
    void this.load();
  }

  /** Also used by pull-to-refresh and the "Try again" button. */
  protected readonly reload = () => this.load();

  private async load() {
    this.error.set('');
    this.loading.set(true);
    try {
      const [best, fresh] = await Promise.all([
        this.products.list({ collection: 'best', limit: 4 }),
        this.products.list({ collection: 'new', limit: 4, sort: 'newest' }),
      ]);
      this.bestSellers.set(best.items);
      this.newArrivals.set(fresh.items);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
