import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ProductSummary } from './models';
import { ProductService } from './product.service';
import { StorageService } from './storage.service';

const GUEST_WISHLIST_KEY = 'guestWishlist';

/** Saved perfumes. Stored in the database for members and on the device for guests. */
@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly products = inject(ProductService);
  private readonly api = `${environment.apiUrl}/wishlist`;

  /** Ids of every saved perfume. Used to fill in the hearts on product cards. */
  readonly ids = signal<ReadonlySet<number>>(new Set());
  /** Full product details, loaded by the wishlist page. */
  readonly items = signal<ProductSummary[]>([]);
  readonly loading = signal(false);

  /** Finishes when the saved wishlist has been loaded. Changes wait for it so a late load cannot overwrite them. */
  private ready: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => {
        this.ready = this.ready.then(() => this.onUserChanged(user !== null));
      });
    });
  }

  has(productId: number): boolean {
    return this.ids().has(productId);
  }

  /** Saves or removes a perfume. Returns true when it is saved afterwards. */
  async toggle(productId: number): Promise<boolean> {
    await this.ready;
    const saving = !this.has(productId);
    const previous = this.ids();

    // Update the heart straight away, and undo it if the server refuses
    this.ids.set(this.withId(previous, productId, saving));
    try {
      if (this.auth.isLoggedIn()) {
        const list = await firstValueFrom(
          saving ? this.http.put<ProductSummary[]>(`${this.api}/${productId}`, {}) : this.http.delete<ProductSummary[]>(`${this.api}/${productId}`),
        );
        this.setList(list);
      } else {
        await this.storage.set(GUEST_WISHLIST_KEY, [...this.ids()]);
        this.items.update((items) => items.filter((item) => saving || item.id !== productId));
      }
    } catch (error) {
      this.ids.set(previous);
      throw error;
    }
    return saving;
  }

  async refresh(): Promise<void> {
    await this.ready;
    this.loading.set(true);
    try {
      if (this.auth.isLoggedIn()) {
        this.setList(await firstValueFrom(this.http.get<ProductSummary[]>(this.api)));
      } else {
        const ids = [...this.ids()];
        const list = ids.length ? (await this.products.list({ ids, limit: 100 })).items : [];
        // Newest first, like the member's list
        this.items.set(list.sort((a, b) => ids.indexOf(b.id) - ids.indexOf(a.id)));
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async onUserChanged(loggedIn: boolean): Promise<void> {
    try {
      const guestIds = (await this.storage.get<number[]>(GUEST_WISHLIST_KEY)) ?? [];

      if (!loggedIn) {
        this.items.set([]);
        this.ids.set(new Set(guestIds));
        return;
      }

      const list =
        guestIds.length > 0
          ? await firstValueFrom(this.http.post<ProductSummary[]>(`${this.api}/merge`, { productIds: guestIds }))
          : await firstValueFrom(this.http.get<ProductSummary[]>(this.api));
      this.setList(list);
      await this.storage.remove(GUEST_WISHLIST_KEY);
    } catch {
      // Offline: hearts load next time. A guest's saved perfumes stay on the device.
    }
  }

  private setList(list: ProductSummary[]) {
    this.items.set(list);
    this.ids.set(new Set(list.map((product) => product.id)));
  }

  private withId(ids: ReadonlySet<number>, id: number, present: boolean): ReadonlySet<number> {
    const next = new Set(ids);
    if (present) next.add(id);
    else next.delete(id);
    return next;
  }
}
