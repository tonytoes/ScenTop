import { HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { Observable, delay, from, map } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * In the offline demo app, answers API calls on the phone instead of sending them to a server.
 * Everywhere else it does nothing, and the demo code is never downloaded (it is loaded on first use).
 */
export const demoInterceptor: HttpInterceptorFn = (request, next) => {
  const isApi = request.url === environment.apiUrl || request.url.startsWith(`${environment.apiUrl}/`);
  if (!environment.demo || !isApi) return next(request);
  return from(import('./demo-backend')).pipe(
    // A short pause, so spinners and button states behave like they do with a real server
    delay(150),
    map((backend) => backend.handleDemoRequest(request, environment.apiUrl) as HttpEvent<unknown>),
  ) as Observable<HttpEvent<unknown>>;
};
