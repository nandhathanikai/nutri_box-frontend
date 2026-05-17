import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Attaches the bearer token to every outgoing request that targets the
 * Nutribox backend. Login/signup/check-email/forgot-password endpoints
 * are skipped because they're meant to be called pre-auth.
 *
 * If a 401 Unauthorized is returned, it automatically logs the user out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const isPublicAuthEndpoint =
    req.url.includes('/api/auth/login') ||
    req.url.includes('/api/auth/signup') ||
    req.url.includes('/api/auth/check-email');

  let cloned = req;
  if (token && !isPublicAuthEndpoint) {
    cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  const router = inject(Router);
  const auth = inject(AuthService);

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Backend rejected our token — could be a server-side expiry, a
        // rotated SECRET_KEY, or a deleted account. Mark it as 'invalid' so
        // the toast doesn't blame inactivity when the user was active.
        if (auth.isLoggedIn()) {
          auth.logout({ reason: 'invalid' });
        } else {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('session_expiry');
          }
          router.navigate(['/home']);
        }
      }
      return throwError(() => error);
    })
  );
};
