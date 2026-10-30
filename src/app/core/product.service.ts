import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { CategoryCount, ProductDetail, ProductList, ProductQuery, Review } from './models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}`;

  list(query: ProductQuery = {}): Promise<ProductList> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
      params = params.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    return firstValueFrom(this.http.get<ProductList>(`${this.api}/products`, { params }));
  }

  get(slug: string): Promise<ProductDetail> {
    return firstValueFrom(this.http.get<ProductDetail>(`${this.api}/products/${encodeURIComponent(slug)}`));
  }

  categories(): Promise<CategoryCount[]> {
    return firstValueFrom(this.http.get<CategoryCount[]>(`${this.api}/categories`));
  }

  reviews(slug: string): Promise<Review[]> {
    return firstValueFrom(this.http.get<Review[]>(`${this.api}/products/${encodeURIComponent(slug)}/reviews`));
  }

  /** Posts a review and returns the product with its updated rating. */
  addReview(slug: string, review: { rating: number; comment: string }): Promise<ProductDetail> {
    return firstValueFrom(this.http.post<ProductDetail>(`${this.api}/products/${encodeURIComponent(slug)}/reviews`, review));
  }
}
