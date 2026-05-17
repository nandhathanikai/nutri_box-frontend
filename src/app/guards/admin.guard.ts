import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // Fetch the current user's profile to check their role
  return auth.getCurrentUser().pipe(
    map((user: any) => {
      // If the user's role is 'admin' (case-insensitive for safety), allow access
      if (user && user.role && user.role.toLowerCase() === 'admin') {
        return true;
      }
      // Otherwise, redirect them to the customer dashboard
      router.navigate(['/dashboard']);
      return false;
    }),
    catchError(() => {
      // On error (e.g., token invalid or network issue), redirect to login
      auth.logout();
      router.navigate(['/login']);
      return of(false);
    })
  );
};
