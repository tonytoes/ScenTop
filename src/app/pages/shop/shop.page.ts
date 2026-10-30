import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { errorMessage } from '../../core/api-error';
import { CATEGORIES, Category, ProductQuery, ProductSort, ProductSummary } from '../../core/models';
import { ProductService } from '../../core/product.service';
import { PageComponent } from '../../layout/page/page.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';

const PAGE_SIZE = 12;

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'name', label: 'Name: A to Z' },
];

/** The filter values that live in the address bar, e.g. /shop?category=Floral&sort=price-asc */
interface Filters {
  q: string;
  category: Category | null;
  audience: 'men' | 'women' | null;
  collection: 'best' | 'new' | null;
  sort: ProductSort;
}

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | null => (allowed.includes(value as T) ? (value as T) : null);

/** Turns the address bar's ?key=value pairs into filters, ignoring anything unexpected. */
function readFilters(params: ParamMap): Filters {
  return {
    q: params.get('q')?.trim() ?? '',
    category: pick(params.get('category'), CATEGORIES),
    audience: pick(params.get('audience'), ['men', 'women'] as const),
    collection: pick(params.get('collection'), ['best', 'new'] as const),
    sort: pick(params.get('sort'), SORTS.map((s) => s.value)) ?? 'featured',
  };
}

@Component({
  selector: 'app-shop',
  imports: [ReactiveFormsModule, IonIcon, PageComponent, ProductCardComponent, EmptyStateComponent],
  templateUrl: './shop.page.html',
  styleUrl: './shop.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopPage {
  private readonly products = inject(ProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  protected readonly categories = CATEGORIES;
  protected readonly sorts = SORTS;

  protected readonly items = signal<ProductSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal('');

  protected readonly searchControl = new FormControl('', { nonNullable: true });

  /** Filters read from the address bar, so links, refreshes and the back button all work. */
  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(readFilters)), {
    initialValue: readFilters(this.route.snapshot.queryParamMap),
  });

  protected readonly hasFilters = computed(() => {
    const f = this.filters();
    return !!(f.q || f.category || f.audience || f.collection);
  });
  protected readonly hasMore = computed(() => this.items().length < this.total());

  /** Guards against an older, slower response replacing a newer one. */
  private requestId = 0;

  constructor() {
    // Reload the list whenever a filter changes
    effect(() => {
      const filters = this.filters();
      untracked(() => void this.load(filters));
    });

    // Keep the search box in step with the address bar, and the address bar in step with the search box
    effect(() => {
      const q = this.filters().q;
      if (q !== this.searchControl.value) this.searchControl.setValue(q, { emitEvent: false });
    });
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.setFilter({ q: q.trim() || null }));

    // The header's search button opens this page with ?focus=search
    effect(() => {
      const box = this.searchBox();
      if (box && this.route.snapshot.queryParamMap.get('focus') === 'search') {
        setTimeout(() => box.nativeElement.focus(), 350);
        void this.setFilter({ focus: null });
      }
    });
  }

  protected setFilter(changes: Record<string, string | null>) {
    return this.router.navigate([], { relativeTo: this.route, queryParams: changes, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected clearFilters() {
    return this.setFilter({ q: null, category: null, audience: null, collection: null });
  }

  protected readonly reload = () => this.load(this.filters());

  protected async loadMore() {
    this.loadingMore.set(true);
    try {
      const page = await this.products.list({ ...this.toQuery(this.filters()), offset: this.items().length });
      this.items.update((items) => [...items, ...page.items]);
      this.total.set(page.total);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loadingMore.set(false);
    }
  }

  private async load(filters: Filters) {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.products.list(this.toQuery(filters));
      if (id !== this.requestId) return;
      this.items.set(page.items);
      this.total.set(page.total);
    } catch (error) {
      if (id === this.requestId) this.error.set(errorMessage(error));
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  private toQuery(filters: Filters): ProductQuery {
    return {
      q: filters.q || undefined,
      category: filters.category ?? undefined,
      audience: filters.audience ?? undefined,
      collection: filters.collection ?? undefined,
      sort: filters.sort,
      limit: PAGE_SIZE,
    };
  }
}
