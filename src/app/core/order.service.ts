import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CartService } from './cart.service';
import { CheckoutForm, Order } from './models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly cart = inject(CartService);
  private readonly api = `${environment.apiUrl}/orders`;

  list(): Promise<Order[]> {
    return firstValueFrom(this.http.get<Order[]>(this.api));
  }

  get(id: number): Promise<Order> {
    return firstValueFrom(this.http.get<Order>(`${this.api}/${id}`));
  }

  /** Turns the saved cart into an order. */
  async place(details: CheckoutForm): Promise<Order> {
    const order = await firstValueFrom(this.http.post<Order>(this.api, details));
    this.cart.reset();
    return order;
  }

  cancel(id: number): Promise<Order> {
    return firstValueFrom(this.http.post<Order>(`${this.api}/${id}/cancel`, {}));
  }
}
