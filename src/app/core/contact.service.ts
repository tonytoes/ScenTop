import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  send(message: { name: string; email: string; message: string }): Promise<unknown> {
    return firstValueFrom(this.http.post(`${environment.apiUrl}/contact`, message));
  }
}
