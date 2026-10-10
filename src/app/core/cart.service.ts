import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Cart, EMPTY_CART } from './models';
import { StorageService } from './storage.service';

interface CartLine {
  variantId: number;
  quantity: number;
}

const GUEST_CART_KEY = 'guestCart';
const MAX_QUANTITY = 99;

/**
 * The shopping cart.
 * - Logged in: the cart lives in the database, so it follows the customer to any device.
 * - Guest: only variant ids and quantities are kept on the device; the server prices them.
 * When a guest logs in, their items are merged into their account.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly api = `${environment.apiUrl}/cart`;

  private readonly guestLines = signal<CartLine[]>([]);
  /** The cart with prices. Call refresh() when a page opens to make sure it is current. */
  readonly cart = signal<Cart>(EMPTY_CART);
  readonly loading = signal(false);

  /** Number shown on the cart badge. Guests see it immediately, before prices are loaded. */
  readonly count = computed(() =>
    this.auth.isLoggedIn() ? this.cart().itemCount : this.guestLines().reduce((sum, line) => sum + line.quantity, 0),
  );

  /** Finishes when the saved cart has been loaded. Changes wait for it so a late load cannot overwrite them. */
  private ready: Promise<void> = Promise.resolve();

  constructor() {
    // Runs at start-up and whenever someone logs in or out, one after the other
    effect(() => {
      const user = this.auth.user();
      untracked(() => {
        this.ready = this.ready.then(() => this.onUserChanged(user !== null));
      });
    });
  }

  async refresh(): Promise<void> {
    await this.ready;
    this.loading.set(true);
    try {
      this.cart.set(this.auth.isLoggedIn() ? await firstValueFrom(this.http.get<Cart>(this.api)) : await this.previewGuestCart());
    } finally {
      this.loading.set(false);
    }
  }

  async add(variantId: number, quantity = 1): Promise<void> {
    await this.ready;
    if (this.auth.isLoggedIn()) {
      this.cart.set(await firstValueFrom(this.http.post<Cart>(`${this.api}/items`, { variantId, quantity })));
      return;
    }
    const lines = this.guestLines();
    const existing = lines.find((line) => line.variantId === variantId);
    await this.saveGuestLines(
      existing
        ? lines.map((line) => (line === existing ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + quantity) } : line))
        : [...lines, { variantId, quantity }],
    );
  }

  async setQuantity(variantId: number, quantity: number): Promise<void> {
    if (quantity < 1) return this.remove(variantId);

    await this.ready;
    if (this.auth.isLoggedIn()) {
      this.cart.set(await firstValueFrom(this.http.patch<Cart>(`${this.api}/items/${variantId}`, { quantity })));
      return;
    }
    await this.saveGuestLines(this.guestLines().map((line) => (line.variantId === variantId ? { ...line, quantity } : line)));
  }

  async remove(variantId: number): Promise<void> {
    await this.ready;
    if (this.auth.isLoggedIn()) {
      this.cart.set(await firstValueFrom(this.http.delete<Cart>(`${this.api}/items/${variantId}`)));
      return;
    }
    await this.saveGuestLines(this.guestLines().filter((line) => line.variantId !== variantId));
  }

  /** The order has been placed: the server already emptied the cart, so only the local copy is reset. */
  reset(): void {
    this.cart.set(EMPTY_CART);
  }

  private async onUserChanged(loggedIn: boolean): Promise<void> {
    try {
      if (!loggedIn) {
        this.cart.set(EMPTY_CART);
        this.guestLines.set((await this.storage.get<CartLine[]>(GUEST_CART_KEY)) ?? []);
        return;
      }

      const guest = this.guestLines().length > 0 ? this.guestLines() : ((await this.storage.get<CartLine[]>(GUEST_CART_KEY)) ?? []);
      this.cart.set(
        guest.length > 0
          ? await firstValueFrom(this.http.post<Cart>(`${this.api}/merge`, { items: guest }))
          : await firstValueFrom(this.http.get<Cart>(this.api)),
      );
      this.guestLines.set([]);
      await this.storage.remove(GUEST_CART_KEY);
    } catch {
      // The server cannot be reached right now. A guest's items stay on the device, and
      // a member's cart loads the next time they open the cart page.
    }
  }

  private async saveGuestLines(lines: CartLine[]): Promise<void> {
    this.guestLines.set(lines);
    await this.storage.set(GUEST_CART_KEY, lines);
    this.cart.set(await this.previewGuestCart());
  }

  private previewGuestCart(): Promise<Cart> {
    const items = this.guestLines();
    return items.length === 0 ? Promise.resolve(EMPTY_CART) : firstValueFrom(this.http.post<Cart>(`${this.api}/preview`, { items }));
  }
}
