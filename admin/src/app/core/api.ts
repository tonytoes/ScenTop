import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type { AdminProduct, AdminUser, Analytics, ContactMessage, CustomerDetail, Order, OrderPage, OrderStatus, Page, ProductInput } from './models';

/** An API failure with a message that is safe to show. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

type Query = Record<string, string | number | undefined | null>;

const params = (query: Query = {}) =>
  new HttpParams({
    fromObject: Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])),
  });

/** Every call the admin app makes. Returns promises so pages can simply await them. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/admin';

  analytics = (days: number) => this.run(this.http.get<Analytics>(`${this.base}/analytics`, { params: params({ days }) }));

  orders = (query: Query) => this.run(this.http.get<OrderPage>(`${this.base}/orders`, { params: params(query) }));
  order = (id: number) => this.run(this.http.get<Order>(`${this.base}/orders/${id}`));
  setOrderStatus = (id: number, status: OrderStatus) => this.run(this.http.patch<Order>(`${this.base}/orders/${id}`, { status }));

  users = (query: Query) => this.run(this.http.get<Page<AdminUser>>(`${this.base}/users`, { params: params(query) }));
  user = (id: number) => this.run(this.http.get<CustomerDetail>(`${this.base}/users/${id}`));
  updateUser = (id: number, changes: Partial<Pick<AdminUser, 'role' | 'isDisabled' | 'firstName' | 'lastName' | 'phone' | 'address'>>) =>
    this.run(this.http.patch<AdminUser>(`${this.base}/users/${id}`, changes));
  deleteUser = (id: number) => this.run(this.http.delete<void>(`${this.base}/users/${id}`));

  products = () => this.run(this.http.get<AdminProduct[]>(`${this.base}/products`));
  createProduct = (input: ProductInput) => this.run(this.http.post<AdminProduct>(`${this.base}/products`, input));
  updateProduct = (id: number, input: ProductInput) => this.run(this.http.put<AdminProduct>(`${this.base}/products/${id}`, input));
  deleteProduct = (id: number) => this.run(this.http.delete<void>(`${this.base}/products/${id}`));

  messages = () => this.run(this.http.get<ContactMessage[]>(`${this.base}/messages`));
  deleteMessage = (id: number) => this.run(this.http.delete<void>(`${this.base}/messages/${id}`));

  private async run<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!(error instanceof HttpErrorResponse)) return new ApiError('Something went wrong. Please try again.', 0);
  const body = error.error?.error;
  if (error.status === 0 || typeof body?.message !== 'string') {
    return new ApiError('Could not reach the ScenTop API. Is it running? Start it from the launcher or with "npm run api".', error.status);
  }
  return new ApiError(body.message, error.status, body.fields ?? {});
}
