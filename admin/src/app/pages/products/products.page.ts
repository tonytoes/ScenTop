import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, ApiError, errorMessage } from '../../core/api';
import { PesoPipe } from '../../core/format';
import { CATEGORIES, type AdminProduct, type Audience, type Category, type ProductInput } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { UiService } from '../../shared/ui.service';

// Pictures that ship with the app (src/assets/products), offered as quick picks
const BUILT_IN_IMAGES = [
  'alriune', 'ambre-sucre', 'artisan', 'athenas-wreath', 'baybayon', 'clio', 'colognia-dreamery', 'deep-rouge', 'fume-shroom',
  'hifumi-atelier', 'l-emetrius', 'lilys-lush', 'melissa', 'nori-blanc', 'rocio-dorado', 'sephyr', 'vera-xong', 'ylang-ylang',
].map((slug) => `assets/products/${slug}.webp`);

const SORTS = {
  name: { label: 'Name', fn: (a: AdminProduct, b: AdminProduct) => a.name.localeCompare(b.name) },
  revenue: { label: 'Revenue', fn: (a: AdminProduct, b: AdminProduct) => b.revenueCents - a.revenueCents },
  units: { label: 'Bottles sold', fn: (a: AdminProduct, b: AdminProduct) => b.unitsSold - a.unitsSold },
  rating: { label: 'Rating', fn: (a: AdminProduct, b: AdminProduct) => b.ratingAvg - a.ratingAvg },
  wished: { label: 'Wishlisted', fn: (a: AdminProduct, b: AdminProduct) => b.wishCount - a.wishCount },
};
type SortKey = keyof typeof SORTS;

interface Draft {
  id: number | null;
  name: string;
  slug: string;
  category: Category;
  audience: Audience;
  description: string;
  notes: string[];
  imageUrl: string;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isActive: boolean;
  /** Prices are edited in pesos and saved in centavos. */
  variants: { sizeMl: number | null; pesos: number | null }[];
}

const blankDraft = (): Draft => ({
  id: null,
  name: '',
  slug: '',
  category: 'Floral',
  audience: 'unisex',
  description: '',
  notes: [],
  imageUrl: BUILT_IN_IMAGES[0]!,
  isBestSeller: false,
  isNewArrival: true,
  isActive: true,
  variants: [
    { sizeMl: 50, pesos: null },
    { sizeMl: 100, pesos: null },
  ],
});

/** Shrinks an uploaded picture so it is at most 900 px wide and saves as WebP. */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/webp', 0.85);
}

@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, PesoPipe],
  templateUrl: './products.page.html',
  styleUrl: './products.page.scss',
})
export class ProductsPage {
  private readonly api = inject(AdminApi);
  private readonly ui = inject(UiService);

  protected readonly categories = CATEGORIES;
  protected readonly images = BUILT_IN_IMAGES;
  protected readonly sorts = Object.entries(SORTS).map(([key, s]) => ({ key: key as SortKey, label: s.label }));

  protected readonly products = signal<AdminProduct[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly filter = signal<Category | 'all' | 'hidden'>('all');
  protected readonly sort = signal<SortKey>('revenue');
  protected readonly query = signal('');

  protected readonly draft = signal<Draft | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly saving = signal(false);
  protected noteInput = '';

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.products()
      .filter((p) => (f === 'all' ? true : f === 'hidden' ? !p.isActive : p.category === f))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.scentNotes.some((n) => n.toLowerCase().includes(q)))
      .sort(SORTS[this.sort()].fn);
  });

  protected readonly summary = computed(() => {
    const list = this.products();
    return {
      live: list.filter((p) => p.isActive).length,
      hidden: list.filter((p) => !p.isActive).length,
      revenue: list.reduce((s, p) => s + p.revenueCents, 0),
      maxRevenue: Math.max(1, ...list.map((p) => p.revenueCents)),
    };
  });

  protected readonly counts = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of this.products()) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  });

  constructor() {
    void this.load();
  }

  protected async load() {
    this.loading.set(true);
    try {
      this.products.set(await this.api.products());
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  // ---- Editor -----------------------------------------------------------------------------------
  protected create() {
    this.fieldErrors.set({});
    this.draft.set(blankDraft());
  }

  protected edit(p: AdminProduct) {
    this.fieldErrors.set({});
    this.draft.set({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      audience: p.audience,
      description: p.description,
      notes: [...p.scentNotes],
      imageUrl: p.imageUrl,
      isBestSeller: p.isBestSeller,
      isNewArrival: p.isNewArrival,
      isActive: p.isActive,
      variants: p.variants.map((v) => ({ sizeMl: v.sizeMl, pesos: v.priceCents / 100 })),
    });
  }

  protected close() {
    this.draft.set(null);
  }

  /** Changes a field of the draft and redraws. */
  protected set<K extends keyof Draft>(key: K, value: Draft[K]) {
    this.draft.update((d) => (d ? { ...d, [key]: value } : d));
  }

  protected addNote() {
    const note = this.noteInput.trim();
    const d = this.draft();
    if (!note || !d || d.notes.includes(note)) return;
    this.set('notes', [...d.notes, note]);
    this.noteInput = '';
  }

  protected removeNote(note: string) {
    this.set('notes', this.draft()!.notes.filter((n) => n !== note));
  }

  protected addVariant() {
    this.set('variants', [...this.draft()!.variants, { sizeMl: null, pesos: null }]);
  }

  protected removeVariant(i: number) {
    this.set('variants', this.draft()!.variants.filter((_, j) => j !== i));
  }

  protected async upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      this.set('imageUrl', await shrinkImage(file));
    } catch {
      this.ui.toast('That file could not be read as a picture.', 'error');
    }
  }

  protected async save() {
    const d = this.draft();
    if (!d) return;
    const input: ProductInput = {
      name: d.name,
      slug: d.slug,
      category: d.category,
      audience: d.audience,
      description: d.description,
      scentNotes: d.notes,
      imageUrl: d.imageUrl,
      isBestSeller: d.isBestSeller,
      isNewArrival: d.isNewArrival,
      isActive: d.isActive,
      variants: d.variants.map((v) => ({ sizeMl: Number(v.sizeMl), priceCents: Math.round(Number(v.pesos) * 100) })),
    };

    this.saving.set(true);
    this.fieldErrors.set({});
    try {
      const saved = d.id ? await this.api.updateProduct(d.id, input) : await this.api.createProduct(input);
      this.products.update((list) => [...list.filter((p) => p.id !== saved.id), saved]);
      this.ui.toast(d.id ? `Saved ${saved.name}` : `${saved.name} added to the shop`);
      this.close();
    } catch (error) {
      if (error instanceof ApiError) this.fieldErrors.set(error.fields);
      this.ui.toast(errorMessage(error), 'error');
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleActive(p: AdminProduct, event: Event) {
    event.stopPropagation();
    try {
      const saved = await this.api.updateProduct(p.id, { ...p, isActive: !p.isActive });
      this.products.update((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      this.ui.toast(saved.isActive ? `${saved.name} is back in the shop` : `${saved.name} is hidden from the shop`);
    } catch (error) {
      this.ui.toast(errorMessage(error), 'error');
    }
  }

  protected async remove() {
    const d = this.draft();
    if (!d?.id) return;
    const ok = await this.ui.confirm({
      title: `Delete ${d.name}?`,
      text: 'It disappears from the shop, carts and wishlists. Past orders keep their copy. Hiding it instead can be undone.',
      action: 'Delete for good',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.deleteProduct(d.id);
      this.products.update((list) => list.filter((p) => p.id !== d.id));
      this.ui.toast(`${d.name} deleted`);
      this.close();
    } catch (error) {
      this.ui.toast(errorMessage(error), 'error');
    }
  }

  protected err(key: string): string {
    const errors = this.fieldErrors();
    return errors[key] ?? Object.entries(errors).find(([k]) => k.startsWith(`${key}.`))?.[1] ?? '';
  }
}
