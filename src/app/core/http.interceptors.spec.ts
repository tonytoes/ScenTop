import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';
import { AuthService } from './auth.service';
import { authInterceptor, errorInterceptor } from './http.interceptors';
import { TokenStore } from './token-store';

describe('http interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let tokens: TokenStore;
  const logout = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    logout.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { logout } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStore);
  });

  it('sends the login token to our API only', () => {
    tokens.token.set('abc123');

    http.get(`${environment.apiUrl}/cart`).subscribe();
    expect(backend.expectOne(`${environment.apiUrl}/cart`).request.headers.get('Authorization')).toBe('Bearer abc123');

    http.get('https://example.test/other').subscribe();
    expect(backend.expectOne('https://example.test/other').request.headers.has('Authorization')).toBe(false);
  });

  it('turns a server error into an ApiError with the message and field errors', () => {
    let error: unknown;
    http.post(`${environment.apiUrl}/auth/signup`, {}).subscribe({ error: (e) => (error = e) });

    backend.expectOne(`${environment.apiUrl}/auth/signup`).flush(
      { error: { message: 'Please check the highlighted fields.', code: 'validation', fields: { email: 'Enter a valid e-mail address.' } } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe('Please check the highlighted fields.');
    expect((error as ApiError).fields).toEqual({ email: 'Enter a valid e-mail address.' });
    expect(logout).not.toHaveBeenCalled();
  });

  it('explains when the server cannot be reached', () => {
    let error: unknown;
    http.get(`${environment.apiUrl}/products`).subscribe({ error: (e) => (error = e) });

    backend.expectOne(`${environment.apiUrl}/products`).error(new ProgressEvent('error'));

    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).message).toMatch(/could not reach the server/i);
  });

  it('logs the customer out when their saved login has expired', () => {
    tokens.token.set('expired');
    http.get(`${environment.apiUrl}/orders`).subscribe({ error: () => undefined });

    backend.expectOne(`${environment.apiUrl}/orders`).flush({ error: { message: 'Please log in to continue.' } }, { status: 401, statusText: 'Unauthorized' });

    expect(logout).toHaveBeenCalledOnce();
  });

  it('does not log anyone out for a wrong password at the login form', () => {
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({ error: () => undefined });

    backend.expectOne(`${environment.apiUrl}/auth/login`).flush({ error: { message: 'Incorrect e-mail or password.' } }, { status: 401, statusText: 'Unauthorized' });

    expect(logout).not.toHaveBeenCalled();
  });
});
