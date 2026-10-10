import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { CATEGORIES } from '../../core/models';
import { ProductService } from '../../core/product.service';
import { PageComponent } from '../../layout/page/page.component';

const FAMILIES: Record<string, { icon: string; text: string }> = {
  Floral: { icon: 'flower-outline', text: 'Soft and romantic scents built around roses, jasmine, lilies and other blooms.' },
  Refreshing: { icon: 'water-outline', text: 'Light citrus, marine and herbal scents that feel clean and energizing.' },
  Gourmand: { icon: 'cafe-outline', text: 'Warm and sweet scents of vanilla, amber, coffee and caramel.' },
  Signature: { icon: 'diamond-outline', text: 'Bold, complex blends made to leave a lasting impression.' },
  Verdant: { icon: 'leaf-outline', text: 'Green and earthy scents of leaves, moss, woods and herbs.' },
};

@Component({
  selector: 'app-about-products',
  imports: [RouterLink, IonIcon, PageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .intro { max-width: 640px; margin-bottom: 32px; color: var(--st-muted); font-size: 16.5px; }
    .grid { display: grid; gap: 16px; }
    .family { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 24px; color: var(--st-ink); text-decoration: none; transition: transform 0.25s ease, box-shadow 0.25s ease; }
    .family:hover { transform: translateY(-3px); box-shadow: var(--st-shadow); text-decoration: none; }
    .icon { display: grid; place-items: center; width: 52px; height: 52px; margin-bottom: 8px; border-radius: 16px; background: var(--st-blush); color: var(--st-rose-dark); font-size: 26px; }
    h2 { font-size: 1.9rem; }
    .family p { color: var(--st-muted); }
    .count { margin-top: 6px; color: var(--st-rose-dark); font-size: 13.5px; font-weight: 600; }
    .promise { margin-top: 40px; padding: 28px; background: var(--st-blush); }
    .promise ul { display: grid; gap: 10px; margin: 14px 0 0; padding: 0; list-style: none; }
    .promise li { display: flex; gap: 10px; }
    .promise ion-icon { flex: none; margin-top: 3px; color: var(--st-rose); font-size: 20px; }
    @media (min-width: 640px) { .grid { grid-template-columns: 1fr 1fr; } }
    @media (min-width: 960px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  `,
  template: `
    <app-page>
      <header class="page-head">
        <div class="container">
          <span class="eyebrow">About our products</span>
          <h1>Five scent families</h1>
        </div>
      </header>

      <section class="container section">
        <p class="intro">
          Every ScenTop perfume belongs to one of five families, so it is easy to find what suits your mood. Each comes in a 50 ml and a 100 ml bottle.
        </p>

        <div class="grid">
          @for (family of families(); track family.name) {
            <a class="card family" routerLink="/shop" [queryParams]="{ category: family.name }">
              <span class="icon"><ion-icon [name]="details(family.name).icon" /></span>
              <h2>{{ family.name }}</h2>
              <p>{{ details(family.name).text }}</p>
              @if (family.count !== undefined) {
                <span class="count">{{ family.count }} {{ family.count === 1 ? 'perfume' : 'perfumes' }}</span>
              }
            </a>
          }
        </div>

        <div class="card promise">
          <h2>Made with care</h2>
          <ul>
            <li><ion-icon name="checkmark-circle" /> High-quality fragrances made from safe ingredients.</li>
            <li><ion-icon name="checkmark-circle" /> Clear scent notes on every product page, so you know what to expect.</li>
            <li><ion-icon name="checkmark-circle" /> Honest reviews from other shoppers, left by real customers.</li>
          </ul>
        </div>
      </section>
    </app-page>
  `,
})
export class AboutProductsPage implements OnInit {
  private readonly products = inject(ProductService);
  private readonly counts = signal<Map<string, number>>(new Map());

  /** The five families always show; the perfume counts are added once the shop answers. */
  protected readonly families = computed(() => CATEGORIES.map((name) => ({ name, count: this.counts().get(name) })));

  async ngOnInit() {
    try {
      const counts = await this.products.categories();
      this.counts.set(new Map(counts.map((c) => [c.name, c.count])));
    } catch {
      // Not important enough to bother the reader with an error
    }
  }

  protected details(name: string) {
    return FAMILIES[name] ?? { icon: 'sparkles-outline', text: '' };
  }
}
