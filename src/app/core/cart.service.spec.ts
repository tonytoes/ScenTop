import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CartService } from './cart.service';
import { Cart } from './models';

const previewUrl = `${environment.apiUrl}/cart/preview`;

function cartWith(variantId: number, quantity: number): Cart {
  const unit = 185000;
  return {
    items: [{ variantId, productId: 1, slug: 'ambre-sucre', name: 'Ambre Sucré', imageUrl: 'x.webp', sizeMl: 50, unitPriceCents: unit, quantity, lineTotalCents: unit * quantity }],
    itemCount: quantity,
    subtotalCents: unit * quantity,
    shippingFeeCents: 5000,
    totalCents: unit * quantity + 5000,
  };
}

describe('CartService as a guest', () => {
  let cart: CartService;
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: signal(null), isLoggedIn: () => false } },
      ],
    });
    cart = TestBed.inject(CartService);
    backend = TestBed.inject(HttpTestingController);
    TestBed.tick(); // lets the start-up effect run
    await Promise.resolve();
  });

  afterEach(() => localStorage.clear());

  const add = async (variantId: number, quantity: number, answer: Cart) => {
    const done = cart.add(variantId, quantity);
    await vi.waitFor(() => backend.expectOne(previewUrl).flush(answer));
    await done;
  };

  it('keeps only variant ids and quantities on the device, and the server supplies prices', async () => {
    await add(7, 2, cartWith(7, 2));

    expect(JSON.parse(localStorage.getItem('CapacitorStorage.guestCart')!)).toEqual([{ variantId: 7, quantity: 2 }]);
    expect(cart.cart().totalCents).toBe(2 * 185000 + 5000);
    expect(cart.count()).toBe(2);
  });

  it('adds to the quantity when the same size is added again', async () => {
    await add(7, 2, cartWith(7, 2));
    await add(7, 3, cartWith(7, 5));

    expect(JSON.parse(localStorage.getItem('CapacitorStorage.guestCart')!)).toEqual([{ variantId: 7, quantity: 5 }]);
    expect(cart.count()).toBe(5);
  });

  it('never goes above 99 of one item', async () => {
    await add(7, 90, cartWith(7, 90));
    await add(7, 90, cartWith(7, 99));

    expect(JSON.parse(localStorage.getItem('CapacitorStorage.guestCart')!)[0].quantity).toBe(99);
  });

  it('removes an item and empties the cart without calling the server', async () => {
    await add(7, 1, cartWith(7, 1));
    await cart.remove(7);

    backend.expectNone(previewUrl);
    expect(cart.count()).toBe(0);
    expect(cart.cart().items).toEqual([]);
  });
});
