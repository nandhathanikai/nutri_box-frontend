import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

export const driverGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  return auth.getCurrentUser().pipe(
    map((user: any) => {
      if (user && user.role && user.role.toLowerCase() === 'driver') {
        // Check is_active — inactive drivers cannot access the dashboard
        if (user.is_active === false) {
          router.navigate(['/login']);
          return false;
        }
        return true;
      }
      // Non-drivers go to their appropriate home
      if (user?.role === 'admin') {
        router.navigate(['/admin']);
      } else {
        router.navigate(['/dashboard']);
      }
      return false;
    }),
    catchError(() => {
      auth.logout();
      router.navigate(['/login']);
      return of(false);
    })
  );
};
